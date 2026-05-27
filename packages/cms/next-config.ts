import type { NextConfig } from "next";
import { withPayload } from "@payloadcms/next/withPayload";

export const withCMS = (config: NextConfig) => withPayload(config);
