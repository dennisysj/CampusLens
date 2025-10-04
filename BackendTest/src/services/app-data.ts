import { AppDataSource } from './typeorm';
import { User } from './entities/User';
import { Product } from './entities/Product';

// Export repositories for easy access
export const userRepository = AppDataSource.getRepository(User);
export const productRepository = AppDataSource.getRepository(Product);

// Export entities
export { User, Product };

// Export data source
export { AppDataSource };
