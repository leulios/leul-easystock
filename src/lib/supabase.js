// Mock Supabase Client that talks to Vercel Serverless Functions

class SupabaseQueryBuilder {
  constructor(table) {
    this.table = table;
    this.query = { table };
  }

  select(columns = '*') {
    this.query.action = 'select';
    this.query.columns = columns;
    return this;
  }

  insert(payload) {
    return this._fetch('POST', payload);
  }

  update(payload) {
    this._updatePayload = payload;
    return this;
  }

  upsert(payload) {
    // Treat as insert for now (since we handle it in API if needed)
    return this._fetch('POST', payload);
  }

  delete() {
    this.query.action = 'delete';
    return this;
  }

  eq(column, value) {
    this.query.eq = { column, value };
    if (this._updatePayload) {
      // Execute update immediately on .eq() like Supabase does
      return this._fetch('PUT', { ...this._updatePayload, id: value });
    }
    if (this.query.action === 'delete') {
      return this._fetch('DELETE', null, value);
    }
    return this;
  }

  gte(column, value) {
    this.query.gte = { column, value };
    return this;
  }

  order(column, options = { ascending: true }) {
    this.query.order = column;
    this.query.ascending = options.ascending;
    return this;
  }

  async _fetch(method, body = null, id = null) {
    let url = `/api/db?table=${this.table}`;
    if (id) url += `&id=${id}`;
    
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : null
    });
    const json = await res.json();
    return { data: json.data, error: json.error ? new Error(json.error) : null };
  }

  then(resolve, reject) {
    // When awaited, execute GET request
    let url = `/api/db?table=${this.table}&action=${this.query.action}`;
    if (this.query.order) url += `&order=${this.query.order}&ascending=${this.query.ascending}`;
    if (this.query.eq) url += `&eqCol=${this.query.eq.column}&eqVal=${this.query.eq.value}`;
    if (this.query.gte) url += `&gteCol=${this.query.gte.column}&gteVal=${this.query.gte.value}`;
    if (this.query.columns && this.query.columns.includes('(')) url += `&join=true`; // Hint for joins

    fetch(url)
      .then(r => r.json())
      .then(json => resolve({ data: json.data, error: json.error ? new Error(json.error) : null }))
      .catch(reject);
  }
}

export const supabase = {
  from: (table) => new SupabaseQueryBuilder(table),
  
  auth: {
    async getSession() {
      const res = await fetch('/api/auth?action=me');
      const data = await res.json();
      return { data: { session: data.user ? { user: data.user } : null }, error: null };
    },
    onAuthStateChange(callback) {
      // Trigger once immediately
      this.getSession().then(({ data }) => callback('INITIAL_SESSION', data.session));
      return { data: { subscription: { unsubscribe: () => {} } } };
    },
    async signInWithPassword({ email, password }) {
      const res = await fetch('/api/auth?action=login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) return { error: new Error(data.error) };
      return { data: { user: data.user }, error: null };
    },
    async signUp({ email, password, options }) {
      const res = await fetch('/api/auth?action=signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email, 
          password, 
          fullName: options?.data?.full_name,
          shopName: 'My Shop' // Simplification
        })
      });
      const data = await res.json();
      if (!res.ok) return { error: new Error(data.error) };
      return { data: { user: data.user }, error: null };
    },
    async signOut() {
      await fetch('/api/auth?action=logout', { method: 'POST' });
      return { error: null };
    },
    async resetPasswordForEmail() {
      return { error: null }; // Mocked
    },
    async updateUser() {
      return { error: null }; // Mocked
    }
  },
  
  functions: {
    async invoke(funcName, { body }) {
      if (funcName === 'create-shopkeeper') {
        const res = await fetch('/api/auth?action=create-shopkeeper', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        const data = await res.json();
        return { data, error: !res.ok ? new Error(data.error) : null };
      }
    }
  }
};
