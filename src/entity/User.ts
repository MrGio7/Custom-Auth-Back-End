import { Field, Int, ObjectType } from "type-graphql";
import { Entity, PrimaryGeneratedColumn, Column, BaseEntity } from "typeorm";

@ObjectType()
@Entity("users")
export class User extends BaseEntity {
  @Field(() => Int)
  @PrimaryGeneratedColumn()
  id: number;

  @Field()
  @Column("text")
  email: string;

  @Column("text")
  password: string;

  @Column("int", { default: 0 })
  tokenVersion: number;
}

export interface UserPayload {
  id: number;
  email: string;
  password: string;
  hasId: any;
  save: any;
  remove: any;
  softRemove: any;
  tokenVersion: any;
  recover: any;
  reload: any;
}
