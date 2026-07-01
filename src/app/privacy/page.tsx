export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-bg-base">
      <div className="max-w-[640px] mx-auto px-6 pt-12 pb-24">
        <h1 className="font-[family:var(--font-space-grotesk)] font-bold text-2xl text-text-primary mb-6">Privacy Policy</h1>
        <div className="space-y-4 text-text-secondary text-sm leading-relaxed">
          <p>Last updated: June 2026</p>
          <p>MeetingMind (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your information.</p>
          <h2 className="font-semibold text-text-primary text-base pt-2">Information We Collect</h2>
          <p>We collect information you provide directly, including meeting transcripts, audio recordings, and account information (email, name) via Google OAuth.</p>
          <h2 className="font-semibold text-text-primary text-base pt-2">How We Use Your Information</h2>
          <p>We use your information to provide and improve our services, including generating meeting summaries, action items, and analytics. Meeting data is stored securely in Supabase and is only accessible to you.</p>
          <h2 className="font-semibold text-text-primary text-base pt-2">Data Sharing</h2>
          <p>We do not sell or share your personal information with third parties, except as necessary to provide our services (e.g., AI providers for meeting analysis).</p>
          <h2 className="font-semibold text-text-primary text-base pt-2">Contact</h2>
          <p>For questions about this policy, please contact us through our GitHub repository.</p>
        </div>
      </div>
    </div>
  );
}
