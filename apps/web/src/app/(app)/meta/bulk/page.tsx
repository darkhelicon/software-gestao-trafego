"use client";

import { useState } from "react";
import Link from "next/link";
import { BulkCreateForm } from "@/components/campaigns/bulk-create-form";
import { JobStatus } from "@/components/tiktok/job-status";

export default function MetaBulkPage() {
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
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <Link href="/meta" className="hover:text-gray-800">
            Meta Ads
          </Link>
          <span>/</span>
          <Link href="/meta/campaigns" className="hover:text-gray-800">
            Campanhas
          </Link>
          <span>/</span>
          <span>Criação em massa</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">
          Criação em massa — Meta
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Crie até 50 campanhas de uma vez. Cada campanha será processada de
          forma assíncrona com retry automático.
        </p>
      </div>

      {jobId && (
        <div
          className={`rounded-xl border p-6 ${
            done
              ? "border-green-200 bg-green-50"
              : "border-blue-200 bg-blue-50"
          }`}
        >
          <h2
            className={`text-sm font-semibold mb-4 ${
              done ? "text-green-800" : "text-blue-800"
            }`}
          >
            {done ? "Processamento concluído" : "Criando campanhas..."}
          </h2>
          <JobStatus jobId={jobId} platform="meta" onDone={handleJobDone} />
          {done && (
            <div className="mt-4 flex gap-2">
              <Link href="/meta/campaigns">
                <button className="text-sm text-blue-600 hover:underline">
                  Ver campanhas
                </button>
              </Link>
              <span className="text-gray-300">·</span>
              <button
                onClick={() => {
                  setJobId(null);
                  setDone(false);
                }}
                className="text-sm text-gray-500 hover:underline"
              >
                Criar mais
              </button>
            </div>
          )}
        </div>
      )}

      {!jobId && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <BulkCreateForm platform="META" onJobCreated={handleJobCreated} />
        </div>
      )}
    </div>
  );
}
