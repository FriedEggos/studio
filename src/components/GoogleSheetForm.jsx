import React, { useState } from 'react';

const GoogleSheetForm = () => {
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);

    const scriptURL = 'https://script.google.com/macros/s/AKfycbypBTkOBriAEKnAu1NwiJZCud4XUPENAuADAUAPgnqlhLlfZLh3R8wfaKT9yBOp06X5/exec'; // Paste your URL here
    const formData = new FormData(e.target);

    fetch(scriptURL, {
      method: 'POST',
      body: formData,
    })
      .then(res => res.json())
      .then(data => {
        alert("Data sent successfully!");
        setLoading(false);
        e.target.reset();
      })
      .catch(err => {
        console.error(err);
        alert("Error sending data.");
        setLoading(false);
      });
  };

  return (
    <form onSubmit={handleSubmit}>
      <input type="text" name="Name" placeholder="Name" required />
      <input type="email" name="Email" placeholder="Email" required />
      <textarea name="Message" placeholder="Message" required />
      <button type="submit" disabled={loading}>
        {loading ? "Submitting..." : "Submit"}
      </button>
    </form>
  );
};

export default GoogleSheetForm;