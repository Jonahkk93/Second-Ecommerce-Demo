import { Controller, Get, Inject, Module, Query, UseGuards } from "@nestjs/common";
import { desc } from "drizzle-orm";
import { AdminGuard } from "../common/auth";
import { DB, Database } from "../database/database.module";
import { orderItems, orders, products, users } from "../database/schema";

const allowedRanges = new Set([7, 30, 90, 365]);
const dayMs = 24 * 60 * 60 * 1000;

function percentageChange(current: number, previous: number) {
  if (!previous) return current ? 100 : 0;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

function dayKey(value: Date | string) {
  return new Date(value).toISOString().slice(0, 10);
}

@UseGuards(AdminGuard)
@Controller("admin/analytics")
class AnalyticsController {
  constructor(@Inject(DB) private db: Database) {}

  @Get()
  async report(@Query("range") requestedRange?: string) {
    const parsedRange = Number(requestedRange || 30);
    const rangeDays = allowedRanges.has(parsedRange) ? parsedRange : 30;
    const now = new Date();
    const currentStart = new Date(now.getTime() - rangeDays * dayMs);
    const previousStart = new Date(currentStart.getTime() - rangeDays * dayMs);

    const [allOrders, allItems, allProducts, allUsers] = await Promise.all([
      this.db.select().from(orders).orderBy(desc(orders.createdAt)),
      this.db.select().from(orderItems),
      this.db.select().from(products),
      this.db.select().from(users)
    ]);

    const inWindow = (date: Date, start: Date, end: Date) => date >= start && date < end;
    const currentOrders = allOrders.filter(order => inWindow(order.createdAt, currentStart, now));
    const previousOrders = allOrders.filter(order => inWindow(order.createdAt, previousStart, currentStart));
    const revenue = (rows: typeof allOrders) => rows.filter(order => order.status !== "cancelled").reduce((total, order) => total + order.total, 0);
    const delivered = (rows: typeof allOrders) => rows.filter(order => order.status === "delivered").length;
    const eligible = (rows: typeof allOrders) => rows.filter(order => order.status !== "cancelled").length;
    const currentRevenue = revenue(currentOrders);
    const previousRevenue = revenue(previousOrders);
    const currentCustomers = allUsers.filter(user => user.role === "customer" && inWindow(user.createdAt, currentStart, now)).length;
    const previousCustomers = allUsers.filter(user => user.role === "customer" && inWindow(user.createdAt, previousStart, currentStart)).length;

    const daily = new Map<string, { revenue: number; orders: number }>();
    for (let offset = rangeDays - 1; offset >= 0; offset -= 1) {
      daily.set(dayKey(new Date(now.getTime() - offset * dayMs)), { revenue: 0, orders: 0 });
    }
    currentOrders.forEach(order => {
      const bucket = daily.get(dayKey(order.createdAt));
      if (!bucket) return;
      bucket.orders += 1;
      if (order.status !== "cancelled") bucket.revenue += order.total;
    });

    const currentOrderIds = new Set(currentOrders.filter(order => order.status !== "cancelled").map(order => order.id));
    const productById = new Map(allProducts.map(product => [product.id, product]));
    const productSales = new Map<string, { id: string; title: string; units: number; revenue: number; image: string; category: string }>();
    allItems.filter(item => currentOrderIds.has(item.orderId)).forEach(item => {
      const product = productById.get(item.productId);
      const metadata = (product?.metadata || {}) as Record<string, unknown>;
      const existing = productSales.get(item.productId) || {
        id: product?.legacyId || item.productId,
        title: item.title,
        units: 0,
        revenue: 0,
        image: product?.imageUrl || "",
        category: String(metadata.category || "products")
      };
      existing.units += item.quantity;
      existing.revenue += item.unitPrice * item.quantity;
      productSales.set(item.productId, existing);
    });

    const categoryMap = new Map<string, number>();
    productSales.forEach(product => categoryMap.set(product.category, (categoryMap.get(product.category) || 0) + product.revenue));
    const statusOrder = ["pending", "processing", "shipped", "delivered", "cancelled"];
    const orderStatuses = statusOrder.map(status => ({ status, count: currentOrders.filter(order => order.status === status).length }));

    return {
      generatedAt: now.toISOString(),
      rangeDays,
      metrics: {
        revenue: { value: currentRevenue, change: percentageChange(currentRevenue, previousRevenue) },
        orders: { value: currentOrders.length, change: percentageChange(currentOrders.length, previousOrders.length) },
        averageOrderValue: { value: eligible(currentOrders) ? Math.round(currentRevenue / eligible(currentOrders)) : 0, change: percentageChange(eligible(currentOrders) ? currentRevenue / eligible(currentOrders) : 0, eligible(previousOrders) ? previousRevenue / eligible(previousOrders) : 0) },
        fulfilmentRate: { value: eligible(currentOrders) ? Number(((delivered(currentOrders) / eligible(currentOrders)) * 100).toFixed(1)) : 0, change: percentageChange(eligible(currentOrders) ? delivered(currentOrders) / eligible(currentOrders) : 0, eligible(previousOrders) ? delivered(previousOrders) / eligible(previousOrders) : 0) },
        customers: { value: currentCustomers, change: percentageChange(currentCustomers, previousCustomers) }
      },
      revenueSeries: [...daily.entries()].map(([date, values]) => ({ date, ...values })),
      orderStatuses,
      categorySales: [...categoryMap.entries()].map(([category, value]) => ({ category, value })).sort((a, b) => b.value - a.value),
      topProducts: [...productSales.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 8),
      recentOrders: currentOrders.slice(0, 8).map(order => {
        const customer = (order.customer || {}) as Record<string, unknown>;
        const customerName = customer.name || customer.fullName || `${String(customer.firstName || "")} ${String(customer.lastName || "")}`.trim() || customer.email || "Customer";
        return { id: order.legacyId || order.id, customer: String(customerName), total: order.total, status: order.status, createdAt: order.createdAt };
      })
    };
  }
}

@Module({ controllers: [AnalyticsController] })
export class AnalyticsModule {}
