"use client";

import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";

// ─── Plan data ────────────────────────────────────────────────────────────────

const PLANS = [
  {
    slug: "START",
    name: "Start",
    price: 197,
    description: "Entrada para quem está começando a operar campanhas.",
    features: [
      "3 Business Centers",
      "20 campanhas / dia",
      "60 anúncios / dia",
      "Apelação em massa",
      "Dashboard básico",
      "Suporte padrão",
    ],
    popular: false,
  },
  {
    slug: "GROWTH",
    name: "Growth",
    price: 497,
    description: "Para quem já possui operação com maior volume.",
    features: [
      "6 Business Centers",
      "40 campanhas / dia",
      "120 anúncios / dia",
      "Templates de campanha",
      "Fila de criação em massa",
      "Relatórios por conta",
    ],
    popular: false,
  },
  {
    slug: "SCALE",
    name: "Scale",
    price: 697,
    description: "Para operações de alta performance.",
    features: [
      "12 Business Centers",
      "80 campanhas / dia",
      "240 anúncios / dia",
      "Automações de regras",
      "Alertas de performance",
      "Métricas avançadas",
    ],
    popular: true,
  },
  {
    slug: "ENTERPRISE",
    name: "Enterprise",
    price: 1397,
    description: "Para agências e operações grandes.",
    features: [
      "Business Centers ilimitados",
      "Campanhas ilimitadas",
      "Anúncios ilimitados",
      "Suporte prioritário",
      "Limites personalizados",
      "Webhooks e integrações",
    ],
    popular: false,
  },
];

const FEATURES = [
  {
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    title: "Criação em massa",
    description:
      "Crie dezenas de campanhas em minutos com templates reutilizáveis e fila de processamento assíncrono.",
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    title: "Automações inteligentes",
    description:
      "Defina regras automáticas: pause campanhas com CPA alto, escale orçamento em vencedoras e receba alertas de performance.",
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    title: "Métricas em tempo real",
    description:
      "Acompanhe CPA, ROAS, CTR, CPC e CPM de todas as contas em um dashboard unificado e atualizado automaticamente.",
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
    title: "Multi-plataforma",
    description:
      "Gerencie TikTok Ads e Meta Ads em um único painel. Conecte múltiplos Business Centers e Business Managers simultaneamente.",
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    title: "Multi-tenant e RBAC",
    description:
      "Gerencie equipes inteiras com controle granular de acesso. Admin, Manager, Operator e Viewer — cada um com suas permissões.",
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
    title: "Segurança enterprise",
    description:
      "Tokens OAuth criptografados, auditoria completa, isolamento de dados por tenant e proteção contra ameaças via Cloud Armor.",
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const { isAuthenticated, hasSubscription } = useAuth();

  const primaryHref = !isAuthenticated
    ? "/register"
    : hasSubscription
    ? "/dashboard"
    : "/billing";

  const primaryLabel = !isAuthenticated
    ? "Começar 7 dias grátis"
    : hasSubscription
    ? "Acessar dashboard"
    : "Assinar agora";

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <Header isAuthenticated={isAuthenticated} hasSubscription={hasSubscription} />
      <Hero primaryHref={primaryHref} primaryLabel={primaryLabel} />
      <Stats />
      <Features />
      <Pricing primaryHref={primaryHref} />
      <FinalCTA primaryHref={primaryHref} primaryLabel={primaryLabel} />
      <Footer />
    </div>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────

function Header({
  isAuthenticated,
  hasSubscription,
}: {
  isAuthenticated: boolean;
  hasSubscription: boolean;
}) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#0a0a0a]/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <Image src="/logo.png" alt="Logo" width={36} height={36} className="rounded-sm" />
          <span className="text-lg font-bold tracking-tight">Helzo Scale</span>
        </Link>

        <nav className="hidden md:flex items-center gap-8 text-sm text-gray-400">
          <a href="#features" className="hover:text-white transition-colors">Funcionalidades</a>
          <a href="#pricing" className="hover:text-white transition-colors">Planos</a>
        </nav>

        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <Link
              href={hasSubscription ? "/dashboard" : "/billing"}
              className="h-9 px-4 rounded-lg bg-brand-400 text-black text-sm font-semibold hover:bg-brand-500 transition-colors flex items-center"
            >
              {hasSubscription ? "Dashboard" : "Assinar"}
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm text-gray-400 hover:text-white transition-colors px-3 py-2"
              >
                Entrar
              </Link>
              <Link
                href="/register"
                className="h-9 px-4 rounded-lg bg-brand-400 text-black text-sm font-semibold hover:bg-brand-500 transition-colors flex items-center"
              >
                Começar grátis
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero({
  primaryHref,
  primaryLabel,
}: {
  primaryHref: string;
  primaryLabel: string;
}) {
  return (
    <section className="pt-40 pb-24 px-6">
      <div className="max-w-4xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-brand-400/30 bg-brand-400/10 text-brand-400 text-sm font-medium mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
          TikTok Ads + Meta Ads — Uma plataforma, escala total
        </div>

        <h1 className="text-5xl md:text-6xl font-extrabold leading-tight tracking-tight mb-6">
          Gerencie milhares de{" "}
          <span className="text-brand-400">campanhas</span>{" "}
          em um único lugar
        </h1>

        <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          Plataforma enterprise para quem opera TikTok Ads e Meta Ads em escala.
          Crie, automatize e monitore campanhas com velocidade e precisão.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href={primaryHref}
            className="w-full sm:w-auto h-12 px-8 rounded-xl bg-brand-400 text-black font-bold text-base hover:bg-brand-500 transition-colors flex items-center justify-center gap-2"
          >
            {primaryLabel}
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
          <a
            href="#pricing"
            className="w-full sm:w-auto h-12 px-8 rounded-xl border border-white/10 text-white font-medium text-base hover:border-white/25 hover:bg-white/5 transition-colors flex items-center justify-center"
          >
            Ver planos
          </a>
        </div>

        <p className="mt-5 text-sm text-gray-500">
          7 dias grátis · Sem cartão de crédito para começar
        </p>
      </div>
    </section>
  );
}

// ─── Stats ────────────────────────────────────────────────────────────────────

function Stats() {
  const items = [
    { value: "10.000+", label: "Campanhas criadas" },
    { value: "99,9%", label: "Uptime garantido" },
    { value: "4 plataformas", label: "TikTok + Meta integradas" },
    { value: "< 2s", label: "Tempo médio de resposta" },
  ];

  return (
    <section className="border-y border-white/5 bg-white/[0.02] py-10">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
        {items.map((item) => (
          <div key={item.label} className="text-center">
            <p className="text-3xl font-extrabold text-brand-400">{item.value}</p>
            <p className="text-sm text-gray-500 mt-1">{item.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Features ─────────────────────────────────────────────────────────────────

function Features() {
  return (
    <section id="features" className="py-24 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-extrabold mb-4">
            Tudo que você precisa para{" "}
            <span className="text-brand-400">operar em escala</span>
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto">
            Cada funcionalidade foi construída pensando em operações reais de
            alto volume — sem limitações artificiais.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="p-6 rounded-2xl border border-white/5 bg-white/[0.03] hover:border-brand-400/20 hover:bg-white/[0.05] transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-brand-400/10 text-brand-400 flex items-center justify-center mb-5 group-hover:bg-brand-400/20 transition-colors">
                {feature.icon}
              </div>
              <h3 className="text-lg font-bold mb-2">{feature.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Pricing ──────────────────────────────────────────────────────────────────

function Pricing({ primaryHref }: { primaryHref: string }) {
  return (
    <section id="pricing" className="py-24 px-6 border-t border-white/5">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-extrabold mb-4">
            Planos para toda operação
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto">
            Do iniciante à agência. Comece com 7 dias grátis em qualquer plano.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {PLANS.map((plan) => (
            <div
              key={plan.slug}
              className={`relative flex flex-col rounded-2xl border p-6 ${
                plan.popular
                  ? "border-brand-400 bg-brand-400/5"
                  : "border-white/5 bg-white/[0.03]"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="text-xs font-bold text-black bg-brand-400 px-3 py-1 rounded-full whitespace-nowrap">
                    Mais popular
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-lg font-bold mb-1">{plan.name}</h3>
                <p className="text-gray-500 text-sm mb-4">{plan.description}</p>
                <p className="text-4xl font-extrabold">
                  R$ {plan.price.toLocaleString("pt-BR")}
                  <span className="text-base font-normal text-gray-500">/mês</span>
                </p>
              </div>

              <ul className="space-y-2.5 flex-1 mb-8">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-gray-300">
                    <svg
                      className="w-4 h-4 text-brand-400 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                href={primaryHref}
                className={`w-full h-11 rounded-xl font-semibold text-sm flex items-center justify-center transition-colors ${
                  plan.popular
                    ? "bg-brand-400 text-black hover:bg-brand-500"
                    : "border border-white/10 text-white hover:border-white/25 hover:bg-white/5"
                }`}
              >
                Começar agora
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Final CTA ────────────────────────────────────────────────────────────────

function FinalCTA({
  primaryHref,
  primaryLabel,
}: {
  primaryHref: string;
  primaryLabel: string;
}) {
  return (
    <section className="py-24 px-6 border-t border-white/5">
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="text-3xl md:text-4xl font-extrabold mb-4">
          Pronto para operar em{" "}
          <span className="text-brand-400">outro nível</span>?
        </h2>
        <p className="text-gray-400 mb-10 text-lg">
          Comece hoje e tenha 7 dias grátis para testar tudo sem compromisso.
          Sem cartão de crédito, sem burocracia.
        </p>
        <Link
          href={primaryHref}
          className="inline-flex items-center gap-2 py-3 px-10 rounded-xl bg-brand-400 text-black font-bold text-lg hover:bg-brand-500 transition-colors"
        >
          {primaryLabel}
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </Link>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="border-t border-white/5 py-10 px-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="Logo" width={28} height={28} className="rounded-sm" />
          <span className="text-sm font-bold text-gray-300">Helzo Scale</span>
        </div>
        <p className="text-xs text-gray-600">
          © {new Date().getFullYear()} Helzo Scale. Todos os direitos reservados.
        </p>
        <div className="flex items-center gap-5 text-xs text-gray-500">
          <a href="/login" className="hover:text-white transition-colors">Entrar</a>
          <a href="/register" className="hover:text-white transition-colors">Criar conta</a>
        </div>
      </div>
    </footer>
  );
}
