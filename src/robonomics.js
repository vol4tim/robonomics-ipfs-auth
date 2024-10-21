import { Robonomics } from "robonomics-interface";

const instances = {};

export async function instance(name) {
  if (instances[name]) {
    return instances[name]
  }
  let endpoint = "wss://kusama.rpc.robonomics.network/";
  if (name === "polkadot") {
    endpoint = "wss://polkadot.rpc.robonomics.network/";
  }
  instances[name] = await Robonomics.createInstance({
    endpoint: endpoint,
  });
  return instances[name]
}
