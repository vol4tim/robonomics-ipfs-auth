import { hexToU8a, stringToU8a, u8aConcat, u8aToU8a } from "@polkadot/util";
import { signatureVerify } from "@polkadot/util-crypto";
import { AuthError, Failure } from "./errors";
import { instance } from "./robonomics";

const chainTypeDelimiter = "-";
const pkSigDelimiter = ":";

function authSubstrate(data) {
  const { address, signature } = data;

  try {
    const message = stringToU8a(address);

    if (signatureVerify(message, hexToU8a(signature), address).isValid) {
      return true;
    }

    // verify talisman wallet's signature with eth account
    if (signatureVerify(address, signature, address).isValid) {
      return true;
    }

    const wrappedMessage = u8aConcat(
      u8aToU8a("<Bytes>"),
      message,
      u8aToU8a("</Bytes>")
    );

    return signatureVerify(wrappedMessage, hexToU8a(signature), address)
      .isValid;
  } catch (error) {}
  return false;
}

const DAYS_TO_MS = 24 * 60 * 60 * 1000;

const validUntil = (data) => {
  if (data === null) {
    return "";
  }
  if (data.kind.isLifetime) {
    return null;
  }
  const issue_time = data.issueTime.toNumber();
  let days = 0;
  if (data.kind.isDaily) {
    days = data.kind.value.days.toNumber();
  }
  return issue_time + days * DAYS_TO_MS;
};

const isActive = (data) => {
  const until = validUntil(data);
  if (data === null || (until !== null && Date.now() > until)) {
    return false;
  }
  return true;
};

async function checkSubscriptionByChain(robonomics, owner, address) {
  const res = await robonomics.rws.getLedger(owner);
  if (res.isEmpty) {
    return false;
  }
  if (!isActive(res.value)) {
    return false;
  }

  const devicesRaw = await robonomics.rws.getDevices(owner);
  const devices = devicesRaw.map((item) => {
    return item.toHuman();
  });
  if (devices.includes(address)) {
    return true;
  }
  return false;
}
async function checkSubscription(owner, address) {
  const r = await checkSubscriptionByChain(
    await instance("kusama"),
    owner,
    address
  );
  if (r) {
    return true;
  }
  return await checkSubscriptionByChain(
    await instance("polkadot"),
    owner,
    address
  );
}

export async function auth(req, res, next) {
  // 1. Parse basic auth header 'Authorization: Basic [AuthToken]'
  if (!req.headers.robonomics) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify(Failure.unauthorized("Subscription owner not found"))
    );
    return;
  }
  if (
    !req.headers.authorization.includes("Basic ") &&
    !req.headers.authorization.includes("Bearer ")
  ) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify(Failure.unauthorized("Empty Signature")));
    return;
  }

  try {
    const owner = req.headers.robonomics;
    console.log("owner", owner);

    // 2. Decode AuthToken
    const base64Credentials = req.headers.authorization.split(" ")[1];
    const credentials = Buffer.from(base64Credentials, "base64").toString(
      "ascii"
    );

    // 3. Parse AuthToken as `ChainType[substrate/eth/solana]-PubKey-txMsg-tyMsg-tzMsg-tkMsg:SignedMsg`
    const [addressPased, sig] = credentials.split(pkSigDelimiter);
    console.log(`Got public address '${addressPased}' and signature '${sig}'`);

    // 4. Extract chain type, default: 'sub' if not specified
    const gaugedAddress = addressPased.includes(chainTypeDelimiter)
      ? addressPased
      : `sub${chainTypeDelimiter}${addressPased}`;
    const [chainType, address] = gaugedAddress.split(chainTypeDelimiter);

    const result = authSubstrate({
      address,
      signature: sig,
    });

    if (result === true) {
      const resultSubscription = await checkSubscription(owner, address);

      if (resultSubscription) {
        console.log(
          `Validate chainType: ${chainType} address: ${address} success`
        );
        res.chainAddress = address;
        next();
      } else {
        console.error("Subscription failed");
        res.writeHead(401, { "Content-Type": "application/json" });

        res.end(JSON.stringify(Failure.unauthorized("Invalid subscription")));
      }
    } else {
      console.error("Validation failed");
      res.writeHead(401, { "Content-Type": "application/json" });

      res.end(JSON.stringify(Failure.unauthorized("Invalid Signature")));
    }
  } catch (error) {
    console.error(error.message);
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify(
        Failure.unauthorized(
          error instanceof AuthError ? error.message : "Invalid Signature"
        )
      )
    );
    return;
  }
}
