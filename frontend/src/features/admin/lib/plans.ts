/** The plan form of the platform settings: what it holds and what it checks before sending. */
import type { AdminPlan } from '../types';

/** What the form holds while a plan is edited (the price as typed). */
export interface PlanValues {
  name: string;
  description: string;
  price: string;
}

export type PlanErrors = Partial<Record<keyof PlanValues, string>>;

const PRICE = /^\d{1,4}(\.\d{1,2})?$/;

/** The plan as the form starts from it: the price with its two decimals. */
export const planValues = (plan: Pick<AdminPlan, 'name' | 'description' | 'price'>): PlanValues => ({
  name: plan.name,
  description: plan.description,
  price: Number(plan.price).toFixed(2),
});

/** What is wrong with a plan before it is sent (empty when it is fine). */
export function validatePlan(values: PlanValues): PlanErrors {
  const errors: PlanErrors = {};
  if (!values.name.trim()) errors.name = 'A plan needs a name';
  else if (values.name.trim().length > 100) errors.name = 'At most 100 characters';
  if (values.description.length > 500) errors.description = 'At most 500 characters';
  if (!PRICE.test(values.price.trim()) || Number(values.price) <= 0) {
    errors.price = 'A price above 0, with at most two decimals (up to 9999.99)';
  }
  return errors;
}
