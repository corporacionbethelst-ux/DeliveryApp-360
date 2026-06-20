export interface OrderAmountSource {
  total_amount?: number | string | null;
  total?: number | string | null;
  subtotal?: number | string | null;
  delivery_fee?: number | string | null;
  items?: Array<{
    quantity?: number | string | null;
    unit_price?: number | string | null;
    subtotal?: number | string | null;
  }> | null;
}

const toFiniteNumber = (value: number | string | null | undefined): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const firstPositiveAmount = (...values: Array<number | string | null | undefined>): number | null => {
  for (const value of values) {
    const amount = toFiniteNumber(value);
    if (amount !== null && amount > 0) return amount;
  }
  return null;
};

export const resolveOrderCollectAmount = (order: OrderAmountSource): number => {
  const directAmount = firstPositiveAmount(order.total_amount, order.total);
  if (directAmount !== null) return directAmount;

  const subtotal = toFiniteNumber(order.subtotal) ?? 0;
  const deliveryFee = toFiniteNumber(order.delivery_fee) ?? 0;
  const subtotalAmount = subtotal + deliveryFee;
  if (subtotalAmount > 0) return subtotalAmount;

  const itemsAmount = order.items?.reduce((sum, item) => {
    const explicitSubtotal = toFiniteNumber(item.subtotal);
    if (explicitSubtotal !== null) return sum + explicitSubtotal;

    const quantity = toFiniteNumber(item.quantity) ?? 0;
    const unitPrice = toFiniteNumber(item.unit_price) ?? 0;
    return sum + quantity * unitPrice;
  }, 0) ?? 0;

  return itemsAmount > 0 ? itemsAmount + deliveryFee : 0;
};
