import "server-only";
import Stripe from "stripe";
import { keys } from "./keys";

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  stripeClient ??= new Stripe(keys().STRIPE_SECRET_KEY, {
    apiVersion: "2026-05-27.dahlia",
  });

  return stripeClient;
}

export const stripe = new Proxy({} as Stripe, {
  get(_target, property, receiver) {
    return Reflect.get(getStripe(), property, receiver);
  },
});

export type { Stripe } from "stripe";
