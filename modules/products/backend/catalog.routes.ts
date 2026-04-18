import { Router } from 'express';
import { CatalogController } from './catalog.controller';
import { authenticate } from '../../../packages/utils/src/auth.middleware';

const router = Router();

// Catalog Products
router.post('/products', authenticate, CatalogController.createProduct as never);
router.get('/products', authenticate, CatalogController.listProducts as never);
router.get('/products/:id', authenticate, CatalogController.getProduct as never);
router.patch('/products/:id', authenticate, CatalogController.updateProduct as never);
router.delete('/products/:id', authenticate, CatalogController.deleteProduct as never);

// Orders
router.post('/orders', authenticate, CatalogController.createOrder as never);
router.get('/orders', authenticate, CatalogController.listOrders as never);
router.get('/orders/:id', authenticate, CatalogController.getOrder as never);
router.patch('/orders/:id/status', authenticate, CatalogController.updateOrderStatus as never);
router.post('/orders/:id/payment', authenticate, CatalogController.recordPayment as never);

// Stats
router.get('/stats', authenticate, CatalogController.getStats as never);

export default router;
