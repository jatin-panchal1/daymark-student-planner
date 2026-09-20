import { Link } from "wouter";

export default function PrivacyPolicy() {
  return (
    <div className="policy-page">
      <div className="policy-container">
        <nav className="policy-nav">
          <Link href="/" className="policy-back">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
            Back to Daymark
          </Link>
        </nav>

        <header className="policy-header">
          <p className="eyebrow coral">LEGAL</p>
          <h1>Privacy Policy</h1>
          <p className="policy-updated">Last updated: September 20, 2026</p>
        </header>

        <article className="policy-content">
          <section>
            <h2>1. Introduction</h2>
            <p>
              Daymark ("we," "our," or "us") is a student planner application that helps students 
              organize their classes, tasks, and academic progress. This Privacy Policy explains how 
              we collect, use, store, and protect your information when you use our application at{" "}
              <strong>scheduler-opal-pi.vercel.app</strong>.
            </p>
            <p>
              By using Daymark, you agree to the collection and use of information in accordance 
              with this policy.
            </p>
          </section>

          <section>
            <h2>2. Information We Collect</h2>
            <p>When you sign in with Google, we collect the following information:</p>
            <ul>
              <li><strong>Name</strong> — Your display name from your Google account, used to personalize your experience.</li>
              <li><strong>Email address</strong> — Used to identify your account and for sign-in purposes.</li>
              <li><strong>Profile picture</strong> — Displayed within the app for your convenience.</li>
            </ul>
            <p>
              If you grant calendar access, we also access:
            </p>
            <ul>
              <li><strong>Google Calendar events (read-only)</strong> — We read your calendar events 
              to display them alongside your Daymark schedule. We do <em>not</em> create, modify, 
              or delete any events in your Google Calendar.</li>
            </ul>
          </section>

          <section>
            <h2>3. How We Use Your Information</h2>
            <p>Your information is used solely to:</p>
            <ul>
              <li>Authenticate your identity and maintain your session</li>
              <li>Display your name and profile picture in the app</li>
              <li>Show your Google Calendar events alongside your Daymark tasks and class schedule</li>
              <li>Provide a personalized planning experience</li>
            </ul>
            <p>
              We do <strong>not</strong> use your data for advertising, analytics profiling, 
              credit scoring, or any purpose unrelated to the core functionality of the Daymark planner.
            </p>
          </section>

          <section>
            <h2>4. Google API Services — Limited Use Disclosure</h2>
            <p>
              Daymark's use and transfer of information received from Google APIs adheres to the{" "}
              <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer">
                Google API Services User Data Policy
              </a>, including the Limited Use requirements.
            </p>
            <p>Specifically:</p>
            <ul>
              <li>We only use Google Calendar data to display your events within the Daymark planner interface.</li>
              <li>We do not transfer Google user data to third parties, except as necessary to provide the service, for security purposes, or to comply with applicable law.</li>
              <li>We do not use Google user data to serve ads or for retargeting.</li>
              <li>We do not allow humans to read your Google data unless you provide explicit consent, or it is required for security or legal compliance.</li>
            </ul>
          </section>

          <section>
            <h2>5. Data Storage and Security</h2>
            <p>
              Your account data (name, email, profile picture) is stored securely in our database. 
              Session authentication is handled via encrypted JWT tokens stored in HTTP-only cookies.
            </p>
            <p>
              Google Calendar data is fetched in real-time when you view your schedule and is 
              <strong> not permanently stored</strong> on our servers. It is only used transiently 
              to render your calendar view.
            </p>
            <p>
              We use industry-standard security measures to protect your data, including HTTPS 
              encryption for all data in transit and secure cookie handling.
            </p>
          </section>

          <section>
            <h2>6. Third-Party Sharing</h2>
            <p>
              We do <strong>not</strong> sell, trade, or share your personal information or 
              Google user data with any third parties, except:
            </p>
            <ul>
              <li>When required by law or legal process</li>
              <li>To protect the security of our service (e.g., investigating abuse)</li>
              <li>With your explicit consent</li>
            </ul>
          </section>

          <section>
            <h2>7. Data Retention and Deletion</h2>
            <p>
              Your account data is retained for as long as you maintain an active account. 
              If you wish to delete your data, you can revoke Daymark's access through your{" "}
              <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">
                Google Account permissions page
              </a>. Upon revocation, we will no longer have access to your Google data.
            </p>
            <p>
              To request complete deletion of your stored account data, please contact us 
              at the email address listed below.
            </p>
          </section>

          <section>
            <h2>8. Your Rights</h2>
            <p>You have the right to:</p>
            <ul>
              <li>Access the personal data we hold about you</li>
              <li>Request deletion of your account and associated data</li>
              <li>Revoke Google OAuth permissions at any time via your Google Account settings</li>
              <li>Withdraw consent for calendar access (the app will continue to work without calendar integration)</li>
            </ul>
          </section>

          <section>
            <h2>9. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify users of any 
              material changes by updating the "Last updated" date at the top of this page.
            </p>
          </section>

          <section>
            <h2>10. Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy or your data, please contact us at:
            </p>
            <p className="policy-contact">
              <strong>Email:</strong> jatin6.panchal@gmail.com
            </p>
          </section>
        </article>

        <footer className="policy-footer">
          <p>© {new Date().getFullYear()} Daymark. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
}
