"use client";

import { use } from "react";
import dynamic from "next/dynamic";

const Viewer = dynamic(() => import("./viewer"), { ssr: false });

export default function ViewPage({
  params,
}: {
  params: Promise<{ fileId: string }>;
}) {
  const { fileId } = use(params);
  return <Viewer fileId={fileId} />;
}
