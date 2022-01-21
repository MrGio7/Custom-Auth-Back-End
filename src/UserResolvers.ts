import {
  Arg,
  Ctx,
  Field,
  Int,
  Mutation,
  ObjectType,
  PubSub,
  Query,
  Resolver,
  Subscription,
  UseMiddleware,
} from "type-graphql";
import { compare, hash } from "bcryptjs";
import { User } from "./entity/User";
import { MyContext } from "./MyContext";
import { createAccessToken, createRefreshToken } from "./auth";
import { isAuth } from "./isAuth";
import { sendRefreshToken } from "./sendRefreshToken";
import { getConnection } from "typeorm";

@ObjectType()
class LoginResponse {
  @Field()
  accessToken: string;
  @Field(() => User)
  user: User;
}

@Resolver()
export class UserResolvers {
  @Query(() => [User])
  users() {
    return User.find();
  }

  @Query(() => Number)
  async userCount() {
    const userCount = await User.count();
    return userCount;
  }

  @Query(() => User, { nullable: true })
  @UseMiddleware(isAuth)
  loggedInUser(@Ctx() { payload }: MyContext) {
    return User.findOne(payload!.userId);
  }

  @Mutation(() => Boolean)
  async logout(@Ctx() { res }: MyContext) {
    sendRefreshToken(res, "");

    return true;
  }

  @Mutation(() => Boolean)
  async revokeRefreshTokensForUser(@Arg("userId", () => Int) userId: number) {
    await getConnection()
      .getRepository(User)
      .increment({ id: userId }, "tokenVersion", 1);

    return true;
  }

  @Mutation(() => Boolean)
  async register(
    @Arg("email") email: string,
    @Arg("password") password: string,
    @PubSub("NOTIFICATIONS") publish: any
  ) {
    const hashedPassword = await hash(password, 12);

    if (email.trim().length === 0) {
      throw new Error("Please enter email");
    }

    if (password.trim().length === 0) {
      throw new Error("Please enter password");
    }

    try {
      await User.insert({
        email,
        password: hashedPassword,
      });
    } catch (error) {
      console.error(error);
      return false;
    }
    await publish();
    return true;
  }

  @Mutation(() => LoginResponse)
  async login(
    @Arg("email") email: string,
    @Arg("password") password: string,
    @Ctx() { res }: MyContext
  ): Promise<LoginResponse> {
    const user = await User.findOne({ where: { email } });

    if (!user) {
      throw new Error("Could not find user");
    }

    const valid = await compare(password, user.password);

    if (!valid) {
      throw new Error("Wrong password");
    }

    // Success login
    sendRefreshToken(res, createRefreshToken(user));
    user.logInCount++;
    await user.save();

    return {
      accessToken: createAccessToken(user),
      user,
    };
  }

  @Subscription(() => Number, { topics: "NOTIFICATIONS" })
  async newUser() {
    const userCount = await User.count();

    return userCount;
  }
}
