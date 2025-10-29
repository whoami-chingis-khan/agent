import { create } from 'zustand';
import { type Order } from '../types/order';

interface OrdersState {
  orders: Order[];
  addOrder: (order: Order) => void;
  clearOrders: () => void;
}

export const useOrdersStore = create<OrdersState>((set) => ({
  orders: [],
  addOrder: (order) => set((state) => ({ orders: [...state.orders, order] })),
  clearOrders: () => set({ orders: [] }),
}));
