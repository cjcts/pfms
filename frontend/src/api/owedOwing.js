export async function getOwedOwing(settled = false) {
  const res = await fetch(`/api/owed-owing?settled=${settled}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}

export async function createOwedOwing(payload) {
  const res = await fetch('/api/owed-owing', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}

export async function settleOwedOwing(id) {
  const res = await fetch(`/api/owed-owing/${id}/settle`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}

export async function deleteOwedOwing(id) {
  const res = await fetch(`/api/owed-owing/${id}`, {
    method: 'DELETE',
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}
