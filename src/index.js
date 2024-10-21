import cors from "cors";
import express from "express";
import * as httpProxy from "http-proxy";
import { auth } from "./auth";
import { instance } from "./robonomics";

instance("kusama");
instance("polkadot");

const server = express();
server.use(cors());
server.use(auth);

const proxy = httpProxy.createProxyServer({});

server.all("*", (req, res) => {
  const target = process.env.IPFS_ENDPOINT || "http://127.0.0.1:5001";
  console.log(`Validation success. Proxying request to ${target}`);

  proxy.web(req, res, { target }, (error) => {
    console.error(error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        Error: error.message,
      })
    );
  });
});

const port = process.env.PORT || 5050;
console.log(`Listening on port ${port}`);
server.listen(port);
