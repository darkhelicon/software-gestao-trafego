"use client";

import { useState } from "react";
import Link from "next/link";
import { BulkCreateForm } from "@/components/campaigns/bulk-create-form";
import { JobStatus } from "@/components/tiktok/job-status";

export default function TikTokBulkPage() {
  const [jobId, setJobId] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function handleJobCreated(id: string) {
    setJobId(id);
    setDone(false);
  }

  function handleJobDone() {
    setDone(true);
  }

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
          <Link href="/tiktok" className="hover:text-white transition-colors">TikTok Ads</Link>
          <span>/</span>
          <Link href="/tiktok/campaigns" className="hover:text-white transition-colors">Campanhas</Link>
          <span>/</span>
          <span className="text-gray-400">Criação em massa</span>
        </div>
        <h1 className="text-2xl font-bold text-white">Criação em massa — TikTok</h1>
        <p className="text-sm text-gray-500 mt-1">
          Crie até 50 campanhas de uma vez. Cada campanha será processada de forma assíncrona com retry automático.
        </p>
      </div>

      {jobId && (
        <div className={`rounded-xl border p-6 ${done ? "border-green-400/20 bg-green-400/5" : "border-brand-400/20 bg-brand-400/5"}`}>
          <h2 className={`text-sm font-semibold mb-4 ${done ? "text-green-400" : "text-brand-400"}`}>
            {done ? "Processamento concluído" : "Criando campanhas..."}
          </h2>
          <JobStatus jobId={jobId} platform="tiktok" onDone={handleJobDone} />
          {done && (
            <div className="mt-4 flex gap-3">
              <Link href="/tiktok/campaigns">
                <button className="text-sm text-brand-400 hover:text-brand-500 transition-colors">Ver campanhas</button>
              </Link>
              <span className="text-white/20">·</span>
              <button
                onClick={() => { setJobId(null); setDone(false); }}
                className="text-sm text-gray-500 hover:text-white transition-colors"
              >
                Criar mais
              </button>
            </div>
          )}
        </div>
      )}

      {!jobId && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
          <BulkCreateForm platform="TIKTOK" onJobCreated={handleJobCreated} />
        </div>
      )}
    </div>
  );
}
