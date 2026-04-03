import React, { useState } from "react";

const GoogleWidget: React.FC = () => {
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);

  // Step 1: Get the Google OAuth URL
  const handleConnect = async () => {
    const res = await fetch("/api/google/login");
    const json = await res.json();
    setAuthUrl(json.auth_url);
    window.location.href = json.auth_url; // Redirect to Google OAuth
  };

  // Step 2: Fetch user data after authentication
  const fetchData = async () => {
    const res = await fetch("/api/google/data");
    const json = await res.json();
    setData(json);
  };

  // Optionally, fetch data on mount if already authenticated
  React.useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="card">
      <h2>Google Account</h2>
      <button onClick={handleConnect}>Connect Google Account</button>
      {data && data.authenticated && (
        <>
          <h3>Recent Emails</h3>
          <ul>
            {data.emails.map((email: any) => (
              <li key={email.id}>
                <strong>{email.from}</strong>: {email.subject}
              </li>
            ))}
          </ul>
          <h3>Upcoming Calendar Events</h3>
          <ul>
            {data.calendar.map((event: any) => (
              <li key={event.id}>
                {event.date} {event.time} - {event.title}
              </li>
            ))}
          </ul>
        </>
      )}
      {data && !data.authenticated && (
        <p>Please connect your Google account.</p>
      )}
    </div>
  );
};

export default GoogleWidget;
