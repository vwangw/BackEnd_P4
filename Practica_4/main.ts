//Practica 4 por Lucía Camiña y Vicente Wang

import {MongoClient, ObjectId} from "mongodb";
import { CartModel, OrderModel, ProductModel, UserModel } from "./types.ts";
import { calculateOrderTotalAndPrepareProducts, fromModelToProduct, updateProductStock } from "./utils.ts";

const MONGO_URL = Deno.env.get("MONGO_URL");

if (!MONGO_URL) {
  console.error("Please provide a MONGO_URL");
  Deno.exit(1);
}

const client = new MongoClient(MONGO_URL);
await client.connect();
console.info("Connected to MongoDB");

const db = client.db("comercio");

const usersCollection = db.collection<UserModel>("users");
const productsCollection = db.collection<ProductModel>("products");
const cartsCollection = db.collection<CartModel>("carts");
const ordersCollection = db.collection<OrderModel>("orders");

const handler = async (request: Request): Promise<Response> => {
  const method = request.method;
  const url = new URL(request.url);
  const path = url.pathname;

  if(method === "GET"){
    if(path==="/users"){
      const users = await usersCollection.find().toArray();
      return new Response (JSON.stringify(users));
    }
    if(path==="/products"){
      const products = await productsCollection.find().toArray();
      return new Response (JSON.stringify(products));
    }
    if(path === "/carts"){
      const userId = url.searchParams.get("userId");
      if (!userId) {
        return new Response("Bad request: userId is required", { status: 400 });
      }

      const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
      if (!user) {
        return new Response("User not found", { status: 404 });
      }

      const cart = await cartsCollection.findOne({ userId: new ObjectId(userId) });
      if (!cart) {
        return new Response("Cart not found", { status: 404 });
      }

      const responseCart = {
        userId: cart.userId.toString(),
        products: await Promise.all(
          cart.products.map(async (product) => {
            const productDetails = await productsCollection.findOne({ _id: product.productId });
    
            if (!productDetails) {
              return {
                productId: product.productId.toString(),
                quantity: product.quantity,
                price: 0, 
              };
            }
    
            const totalPrice = productDetails.price * product.quantity;
    
            return {
              productId: product.productId.toString(),
              name: productDetails.name,
              quantity: product.quantity,
              price: totalPrice, 
            };
          })
        ),
      };
      return new Response(JSON.stringify(responseCart), { status: 200 });

    }else if (path === "/orders") {
  const userId = url.searchParams.get("userId");
  if (!userId) {
    return new Response("Bad request: userId is required", { status: 400 });
  }

  const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
  if (!user) {
    return new Response("User not found", { status: 404 });
  }

  const orders = await ordersCollection.find({ userId: new ObjectId(userId) }).toArray();
  if (orders.length === 0) {
    return new Response("No orders found for this user", { status: 404 });
  }

  const responseOrders = orders.map((order) => ({
    orderId: order._id.toString(),
    userId: order.userId.toString(),
    products: order.products.map((product) => ({
      productId: product.productId.toString(),
      quantity: product.quantity,
      price: product.price,
    })),
    total: order.total,
    orderDate: order.orderDate,
  }));

  return new Response(JSON.stringify(responseOrders), { status: 200 });
}
    
  }else if(method === "POST"){
    if(path==="/users"){
      const user = await request.json();

      if(!user.name || !user.email || !user.password){
        return new Response ("Bad request",{status: 400});
      }

      const existUser = await usersCollection.findOne({ email: user.email });
      if (existUser) {
        return new Response("Email already exists", { status: 409 });
      }

      const {insertedId} = await usersCollection.insertOne ({
        name: user.name,
        email: user.email,
        password: user.password
      });

      return new Response(
        JSON.stringify({
          name: user.name,
          email: user.email,
          id: insertedId
        }),{
          status: 201
        }
      );
    }else if(path==="/products"){
      const product = await request.json();

      if(!product.name || !product.price || !product.stock){
        return new Response ("Bad request",{status: 400});
      }

      const {insertedId} = await productsCollection.insertOne ({
        name: product.name,
        description: product.description || "",
        price: product.price,
        stock: product.stock
      });

      return new Response(
        JSON.stringify({
          id: insertedId,
          name: product.name,
          description: product.description || "",
          price: product.price,
          stock: product.stock
        }),{
          status: 201
        }
      );
    } else if(path === "/carts/products"){
      const userId = url.searchParams.get("userId");
      if(!userId){
        console.error("userId is missing or invalid:", userId);
        return new Response("Bad request: userId is required", { status: 400 });
      }

      const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
      if (!user) {
        return new Response("User not found", { status: 404 });
      }

      const body = await request.json();
      const {productId, quantity } = body;
      if(!productId || !quantity || quantity <= 0){
        return new Response("Bad request", {status:400});
      }

      const product = await productsCollection.findOne({ _id: new ObjectId(productId) });
      if (!product) {
        return new Response("Product not found", { status: 404 });
      }

      if (product.stock < quantity) {
        return new Response("Insufficient stock", { status: 409 });
      }

      let cart = await cartsCollection.findOne({ userId: new ObjectId(userId) });
      if (!cart) {
        const newCart = {
          userId: new ObjectId(userId),
          products: [
            {
              productId: new ObjectId(productId),
              quantity,
              price: product.price* quantity,
            },
          ],
        };
        const { insertedId } = await cartsCollection.insertOne(newCart);
        cart = await cartsCollection.findOne({ _id: insertedId });
      } else {
        const productIndex = cart.products.findIndex((p) =>
          p.productId.equals(new ObjectId(productId))
        );
        if (productIndex >= 0) {
          cart.products[productIndex].quantity += quantity;
    
          if (cart.products[productIndex].quantity > product.stock) {
            return new Response("Insufficient stock", { status: 409 });
          }
          cart.products[productIndex].price = product.price * cart.products[productIndex].quantity;
        } else {
          cart.products.push({
            productId: new ObjectId(productId),
            quantity,
            price: product.price* quantity,
          });
        }
    
        await cartsCollection.updateOne(
          { _id: cart._id },
          { $set: { products: cart.products } }
        );
      }
      cart = await cartsCollection.findOne({ userId: new ObjectId(userId) });
      
      const responseCart = {
        userId: cart!.userId.toString(),
        products: cart!.products.map((product) => ({
          productId: product.productId.toString(),
          quantity: product.quantity,
          price: product.price, 
        })),
      };    
      return new Response(JSON.stringify(responseCart), { status: 200 });
    } else if(path==="/orders"){
      const userId = url.searchParams.get("userId");
    if (!userId) {
      return new Response("Bad request: userId is required", { status: 400 });
    }

    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
    if (!user) {
      return new Response("User not found", { status: 404 });
    }

    const cart = await cartsCollection.findOne({ userId: new ObjectId(userId) });
    if (!cart || cart.products.length === 0) {
      return new Response("Cart is empty or not found", { status: 404 });
    }

      const { total, productsToOrder } = await calculateOrderTotalAndPrepareProducts(cart, productsCollection);
      await updateProductStock(productsToOrder, productsCollection);

      const newOrder: OrderModel = {
        userId: new ObjectId(userId),
        products: productsToOrder,
        total,
        orderDate: new Date(),
      };

      const { insertedId } = await ordersCollection.insertOne(newOrder);
      await cartsCollection.deleteOne({ userId: new ObjectId(userId) });

      const responseOrder = {
        orderId: insertedId.toString(),
        userId: userId,
        products: productsToOrder.map((product) => ({
          productId: product.productId,
          name: product.name,
          quantity: product.quantity,
          price: product.price,
        })),
        total,
        orderDate: newOrder.orderDate,
      };

      return new Response(JSON.stringify(responseOrder), { status: 201 });
    
  }

  }else if(method === "PUT"){
    if(path.startsWith("/products/")){
      const id = path.split("/")[2];
      if(!id) return new Response("Bad request", {status: 400});

      const update = await request.json();

      const dataToUpdate: Partial<ProductModel> = {};
      if(update.name) dataToUpdate.name = update.name;
      if(update.description) dataToUpdate.description = update.description;
      if(update.price) dataToUpdate.price = update.price;
      if(update.stock) dataToUpdate.stock = update.stock;

      if (Object.keys(dataToUpdate).length === 0) {
        return new Response(
          JSON.stringify({ error: "Need at least one field to update"}),{ status: 400 });
      }

      const result = await productsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: dataToUpdate }
      );

      if (result.matchedCount === 0) {
        return new Response(
          JSON.stringify({ error: "Product not found" }),
          { status: 404 }
        );
      }

      const updatedPorduct = await productsCollection.findOne({ _id: new ObjectId(id) });
      return new Response(JSON.stringify(fromModelToProduct(updatedPorduct!)), { status: 200 });
    }
  }else if(method === "DELETE"){
    if (path.startsWith("/products/")) {
      const id = path.split("/")[2];

      if (!id) return new Response("Bad request", { status: 400 });
      
      const inCarts = await cartsCollection.findOne({ products: fromModelToProduct });
      if (inCarts) {
          return new Response("Cannot delete product: it's in carts", { status: 409 });
      }
      const inOrders = await ordersCollection.findOne({ products: fromModelToProduct });
      if (inOrders) {
          return new Response("Cannot delete product: it's in orders", { status: 409 });
      }
      
      const { deletedCount } = await productsCollection.deleteOne({
        _id: new ObjectId(id),
      });

      if (deletedCount === 0) {
        return new Response("Book not found", { status: 404 });
      }

      return new Response("Deleted", { status: 200 });
    
    } else if (path === "/carts/products"){
      const userId = url.searchParams.get('userId');
      const productId = url.searchParams.get('productId');
      if (!userId || !productId) {
        return new Response("Bad request: userId and productId are required", { status: 400 });
      }

      const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
      if (!user) {
        return new Response("User not found", { status: 404 });
      }

      const cart = await cartsCollection.findOne({ userId: new ObjectId(userId) });
      if (!cart) {
        return new Response("Cart not found", { status: 404 });
      }

      const productIndex = cart.products.findIndex(
        (p) => p.productId.toString() === productId
      );
      if (productIndex === -1) {
        return new Response("Product not found in cart", { status: 404 });
      }

      cart.products.splice(productIndex, 1);

      await cartsCollection.updateOne(
        { _id: cart._id },
        { $set: { products: cart.products } }
      );

      const responseCart = {
        userId: cart.userId.toString(),
        products: cart.products.map((product) => ({
          productId: product.productId.toString(),
          quantity: product.quantity,
          price: product.price,
        })),
      };
      return new Response(JSON.stringify(responseCart), { status: 200 });

    } else if (path === "/carts"){
      const userId = url.searchParams.get("userId");
      if (!userId) {
        return new Response("Bad request: userId is required", { status: 400 });
      }

      const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
      if (!user) {
        return new Response("User not found", { status: 404 });
      }

      const cart = await cartsCollection.findOne({ userId: new ObjectId(userId) });
      if (!cart) {
        return new Response("Cart not found", { status: 404 });
      }

      await cartsCollection.deleteOne({ userId: new ObjectId(userId) });
      return new Response(
        JSON.stringify({ message: "Cart emptied successfully" }),
        { status: 200 }
      );
    }
    
  }


  return new Response("endpoint not found", {status:404});
}

Deno.serve({port:3000},handler);