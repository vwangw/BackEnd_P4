import { OptionalId, ObjectId } from "mongodb";

export type UserModel = OptionalId<{
    name: string;
    email:string;
    password: string;
  }>;
  
  export type ProductModel = OptionalId<{
    name: string;
    description: string;
    price: number;
    stock: number;
  }>;

  export type CartModel = OptionalId<{
    userId: ObjectId;
    products: { 
      productId: ObjectId; 
      quantity: number; 
      price: number  
    }[]; 
  }>

  export type OrderModel = OptionalId<{
    userId: ObjectId;
    products: {
      productId: ObjectId;
      quantity: number;
      price: number; 
    }[];
    total: number;
    orderDate: Date;
  }>
  
  export type User = {
    id: string;
    name: string;
    email: string;
    password: string;
  };
  
  export type Product = {
    id: string;
    name: string;
    description: string;
    price: number;
    stock: number;
  };

  export type Cart = {
    id: string;
    userId: ObjectId;
    products: {
      productId: ObjectId;
      quantity: number;
      price: number; 
    }[];
  };
  export type Order = {
    id: string;
    userId: ObjectId;
    products: {
      productId: ObjectId;
      quantity: number;
      price: number; 
    }[];
    total: number;
    orderDate: Date;
  };