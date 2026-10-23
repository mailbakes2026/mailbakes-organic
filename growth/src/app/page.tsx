import { Mark } from "@/components/icons";

export default function HomePage() {
  return (
    <main className="signin">
      <div className="card signin-card chooser">
        <img src="/mailbakes-logo.svg" alt="MailBakes" className="brand-logo" />
        <div>
          <h1>Growth</h1>
          <p className="muted intro">Paid Ads and Retention share this service.</p>
        </div>
        <a className="choice" href="/paidads">
          <span className="mark">
            <Mark kind="megaphone" size={14} />
          </span>
          <span>
            <b>Paid Ads</b>
            <span>Meta and Google Ads</span>
          </span>
        </a>
        <a className="choice" href="/retention">
          <span className="mark">
            <Mark kind="repeat" size={14} />
          </span>
          <span>
            <b>Retention</b>
            <span>Klaviyo and Shopify</span>
          </span>
        </a>
      </div>
    </main>
  );
}
