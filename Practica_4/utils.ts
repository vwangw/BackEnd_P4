import { Collection, ObjectId } from "mongodb";
import { User,UserModel,Cart,CartModel,Order,OrderModel,Product,ProductModel } from "./types.ts";

export const fromModelToUser = (model: UserModel): User => ({
    id: model._id!.toString(),
    name: model.name,
    email: model.email,
    password: model.password
  });


  export const fromModelToProduct = (model: ProductModel): Product => ({
    id: model._id!.toString(),
    name: model.name,
    description: model.description,
    price: model.price,
    stock: model.stock
  });


  export const fromModelToCart = (model: CartModel): Cart => ({
    id: model._id!.toString(),
    userId: model.userId,
    products: model.products.map((product) => ({
      productId: product.productId,
      quantity: product.quantity,
      price: product.price
    })),
  });
  
  export const fromModelToOrder = (model: OrderModel): Order => ({
    id: model._id!.toString(),
    userId: model.userId,
    products: model.products.map((product) => ({
      productId: product.productId,
      quantity: product.quantity,
      price: product.price,
    })),
    total: model.total,
    orderDate: model.orderDate,
  });

  export const calculateOrderTotalAndPrepareProducts = async (
    cart: CartModel,
    productsCollection: Collection<ProductModel>
  ): Promise<{ total: number; productsToOrder: { productId: ObjectId; name: string; quantity: number; price: number }[] }> => {
    let total = 0;
    const productsToOrder: { productId: ObjectId; name: string; quantity: number; price: number }[] = [];
    
    for (const cartItem of cart.products) {
      const product = await productsCollection.findOne({ _id: cartItem.productId });
      if (!product) {
        throw new Error(`Product ${cartItem.productId} not found`);
      }
      
      if (product.stock < cartItem.quantity) {
        throw new Error(`Insufficient stock for product ${product.name}`);
      }
      
      const productTotalPrice = product.price * cartItem.quantity;
      total += productTotalPrice;
      
      productsToOrder.push({
        productId: product._id!,
        name: product.name,
        quantity: cartItem.quantity,
        price: productTotalPrice,
      });
    }
    
    return { total, productsToOrder };
  };
  
  export const updateProductStock = async (
    productsToOrder: OrderModel["products"],
    productsCollection: Collection<ProductModel>
  ): Promise<void> => {
    for (const productOrder of productsToOrder) {
      await productsCollection.updateOne(
        { _id: new ObjectId(productOrder.productId) },
        { $inc: { stock: -productOrder.quantity } }
      );
    }
  };

  export const getOrdersByUserId = async (
    userId: string,
    ordersCollection: Collection<OrderModel>
  ): Promise<Order[]> => {
    const userObjectId = new ObjectId(userId);
    const orders = await ordersCollection.find({ userId: userObjectId }).toArray();
  
    return orders.map(fromModelToOrder);
  };