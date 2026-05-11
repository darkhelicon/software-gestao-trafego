export const dynamic = 'force-dynamic';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-brand-400/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-brand-400/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center mb-4">
            <img src="/helzo-scale-logo.png" alt="Helzo Scale" className="h-20 w-auto" />
          </div>
          <p className="text-sm text-gray-500">
            Gestão profissional de TikTok Ads e Meta Ads
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
