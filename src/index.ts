import "dotenv/config";
import "reflect-metadata";
import express from "express";
import { createServer } from "http";
import { ApolloServer } from "apollo-server-express";
import { execute, subscribe } from "graphql";
import { buildSchema, PubSub } from "type-graphql";
import { UserResolvers } from "./UserResolvers";
import { createConnection } from "typeorm";
import cookieParser from "cookie-parser";
import { verify } from "jsonwebtoken";
// import cors from "cors";
import { createAccessToken, createRefreshToken } from "./auth";
import { User } from "./entity/User";
import { sendRefreshToken } from "./sendRefreshToken";
import { SubscriptionServer } from "subscriptions-transport-ws";

(async () => {
  const app = express();
  const httpServer = createServer(app);
  // app.use(
  //   cors({
  //     origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  //     credentials: true,
  //   })
  // );
  app.use(cookieParser());

  app.get("/", (_req, res) => res.send("hello"));

  app.post("/refresh_token", async (req, res) => {
    const token = req.cookies.jid;
    if (!token) {
      return res.send({ ok: false, accessToken: "" });
    }

    let payload: any = null;
    try {
      payload = verify(token, process.env.REFRESH_TOKEN_SECRET!);
    } catch (error) {
      console.error(error);
      return res.send({ ok: false, accessToken: "" });
    }

    // Token is valid and we can send back an access token
    const user = await User.findOne({ id: payload.userId });

    if (!user) {
      return res.send({ ok: false, accessToken: "" });
    }

    if (user.tokenVersion !== payload.tokenVersion) {
      return res.send({ ok: false, accessToken: "" });
    }

    sendRefreshToken(res, createRefreshToken(user));

    return res.send({ ok: true, accessToken: createAccessToken(user) });
  });

  await createConnection();

  const pubsub = PubSub();

  const schema = await buildSchema({
    resolvers: [UserResolvers],
  });

  const subscriptionServer = SubscriptionServer.create(
    {
      schema,
      execute,
      subscribe,
    },
    {
      server: httpServer,
      path: "/graphql",
    }
  );

  const apolloServer = new ApolloServer({
    schema,
    context: ({ req, res }) => ({ req, res, pubsub }),
    plugins: [
      {
        async serverWillStart() {
          return {
            async drainServer() {
              subscriptionServer.close();
            },
          };
        },
      },
    ],
  });

  await apolloServer.start();

  apolloServer.applyMiddleware({ app });

  const port = process.env.PORT || 5000;

  httpServer.listen(port, () => {
    console.log(`Server is listening port: ${port}`);
  });
})();
