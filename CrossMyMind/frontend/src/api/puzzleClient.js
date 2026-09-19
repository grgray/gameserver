export async function generatePuzzle(subject) {
  const res = await fetch("/api/puzzle", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subject }),
  });

  if (!res.ok) {
    let detail = "Failed to generate puzzle. Please try again.";
    try {
      const data = await res.json();
      if (data && data.detail) detail = data.detail;
    } catch {
      // response wasn't JSON; keep default message
    }
    throw new Error(detail);
  }

  return res.json();
}
