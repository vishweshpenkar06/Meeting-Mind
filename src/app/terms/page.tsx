export default function TermsPage() {
  return (
    <div className="page-shell">
      <div className="page-container max-w-2xl pt-12 pb-24">
        <h1 className="font-display font-bold text-2xl text-text-primary mb-6">Terms of Service</h1>
        <div className="space-y-4 text-text-secondary text-sm leading-relaxed">
          <p>Last updated: June 2026</p>
          <p>Welcome to MeetingMind. By using our service, you agree to these terms.</p>
          <h2 className="font-semibold text-text-primary text-base pt-2">Service Description</h2>
          <p>MeetingMind provides AI-powered meeting transcription, analysis, and note-taking. We are not responsible for the accuracy of AI-generated content.</p>
          <h2 className="font-semibold text-text-primary text-base pt-2">Your Data</h2>
          <p>You retain ownership of all meeting data you upload or create. We will not use your data for purposes other than providing the service.</p>
          <h2 className="font-semibold text-text-primary text-base pt-2">Acceptable Use</h2>
          <p>You agree not to use the service for unlawful purposes or to upload content that violates others&apos; rights.</p>
          <h2 className="font-semibold text-text-primary text-base pt-2">Disclaimer</h2>
          <p>The service is provided &quot;as is&quot; without warranties. AI-generated summaries may contain inaccuracies.</p>
        </div>
      </div>
    </div>
  );
}
