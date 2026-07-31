import { login } from "./actions";

export default async function LoginPage({
  searchParams
}: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="login">
      <form action={login} className="login-card">
        <div className="brand">KINGDOM UNIVERSITY</div>
        <h1>Graduation Platform</h1>
        <p className="muted">Secure access for students and ceremony teams.</p>
        {error && <div className="alert alert-error">Sign-in failed. Check your account or contact ICT.</div>}
        <div className="field">
          <label>Institutional email</label>
          <input name="email" type="email" autoComplete="username" required />
        </div>
        <div className="field">
          <label>Password</label>
          <input name="password" type="password" autoComplete="current-password" minLength={8} required />
        </div>
        <label className="check"><input type="checkbox" name="keep_signed_in" defaultChecked/>Keep me signed in</label><button className="btn btn-primary" style={{width:"100%"}}>Sign in</button>
      </form>
    </main>
  );
}
