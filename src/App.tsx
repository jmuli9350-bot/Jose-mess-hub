// @ts-nocheck
function CrossDeviceSignInPage({ ownerAccount, members, businessAccounts, siteAdminAccount, onLogin, onBusinessLogin, onAdminLogin }: { ownerAccount: OwnerAccount | null; members: Member[]; businessAccounts: BusinessAccount[]; siteAdminAccount?: OwnerAccount | null; onLogin: (memberId: number) => void | Promise<void>; onBusinessLogin: (account: BusinessAccount, memberId?: number, access?: AccessArea[]) => void; onAdminLogin?: (success: boolean) => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    const normalizedUser = username.trim().toLowerCase()
    let hasSupabaseSession = false
    if (isSupabaseConfigured && supabase) {
      const { data: currentSession } = await supabase.auth.getSession()
      hasSupabaseSession = Boolean(currentSession.session)
      if (!hasSupabaseSession) {
        const { data: authData } = await supabase.auth.signInWithPassword({ email: `${normalizedUser}@biztrack.app`, password })
        hasSupabaseSession = Boolean(authData.session)
      }
    }
    const adminMatch = siteAdminAccount && normalizedUser === siteAdminAccount.username.toLowerCase() && await verifyPassword(siteAdminAccount.password, password)
    if (adminMatch) { setError(''); onAdminLogin?.(true); return }
    const ownerMatch = ownerAccount && ownerAccount.username.toLowerCase() === normalizedUser && await verifyPassword(ownerAccount.password, password)
    let localBusinessAccount = businessAccounts.find((account) => account.username.toLowerCase() === normalizedUser)
    if (isSupabaseConfigured && supabase && hasSupabaseSession) {
      const { data: latestAccount } = await supabase.from('business_accounts').select('id,business_name,owner_name,email,username,password,industry,plan,status,seats,monthly_price,next_billing,created_at,tenant_id').ilike('username', normalizedUser).maybeSingle()
      if (latestAccount) localBusinessAccount = { id: latestAccount.id, businessName: latestAccount.business_name, ownerName: latestAccount.owner_name, email: latestAccount.email, username: latestAccount.username, password: latestAccount.password, industry: latestAccount.industry, plan: latestAccount.plan, status: latestAccount.status, seats: latestAccount.seats, monthlyPrice: latestAccount.monthly_price, nextBilling: latestAccount.next_billing, createdAt: latestAccount.created_at, tenantId: latestAccount.tenant_id }
    }
    const member = members.find((item) => item.username.toLowerCase() === normalizedUser)
    const memberMatch = member ? await verifyPassword(member.password, password) : false
    if (ownerMatch) {
      if (localBusinessAccount && businessRequiresActivation(localBusinessAccount)) { setError(localBusinessAccount.status === 'Trial' ? 'This business is waiting for site-admin activation.' : 'This business package has expired. Contact the site admin to reactivate it.'); return }
      setError(''); onLogin(-1); return
    }
    if (member && memberMatch) {
      let memberBusiness = businessAccounts.find((account) => account.tenantId === member.tenantId)
      if (isSupabaseConfigured && supabase && hasSupabaseSession && member.tenantId) {
        const { data: latestBusiness } = await supabase.from('business_accounts').select('id,business_name,owner_name,email,username,password,industry,plan,status,seats,monthly_price,next_billing,created_at,tenant_id').eq('tenant_id', member.tenantId).maybeSingle()
        if (latestBusiness) memberBusiness = { id: latestBusiness.id, businessName: latestBusiness.business_name, ownerName: latestBusiness.owner_name, email: latestBusiness.email, username: latestBusiness.username, password: latestBusiness.password, industry: latestBusiness.industry, plan: latestBusiness.plan, status: latestBusiness.status, seats: latestBusiness.seats, monthlyPrice: latestBusiness.monthly_price, nextBilling: latestBusiness.next_billing, createdAt: latestBusiness.created_at, tenantId: latestBusiness.tenant_id }
      }
      if (memberBusiness && businessRequiresActivation(memberBusiness)) { setError(memberBusiness.status === 'Trial' ? 'This business is waiting for site-admin activation.' : 'This business package has expired or is suspended.'); return }
      setError(''); await onLogin(member.id); return
    }
    const businessAccount = localBusinessAccount
    if (businessAccount && await verifyPassword(businessAccount.password, password)) {
      if (businessRequiresActivation(businessAccount)) { setError(businessAccount.status === 'Trial' ? 'This business is waiting for site-admin activation.' : 'This business package has expired. Contact the site admin to reactivate it.'); return }
      setError(''); onBusinessLogin(businessAccount); return
    }
    if (isSupabaseConfigured && supabase && hasSupabaseSession) {
      setBusy(true)
      const { data: remoteSession } = await supabase.from('workspace_sessions').select('username, tenant_id, workspace_name, owner_name, password_hash').eq('username', normalizedUser).maybeSingle()
      let remoteAccount = remoteSession
      if (!remoteAccount) {
        const { data: legacyAccount } = await supabase.from('business_accounts').select('username, tenant_id, business_name, owner_name, password').eq('username', normalizedUser).maybeSingle()
        if (legacyAccount) remoteAccount = { username: legacyAccount.username, tenant_id: legacyAccount.tenant_id, workspace_name: legacyAccount.business_name, owner_name: legacyAccount.owner_name, password_hash: legacyAccount.password }
      }
      if (remoteAccount && await verifyPassword(remoteAccount.password_hash, password)) {
        let remoteBusiness = businessAccounts.find((account) => account.tenantId === remoteAccount.tenant_id)
        if (!remoteBusiness && supabase) {
          const { data } = await supabase.from('business_accounts').select('id,business_name,owner_name,email,username,password,industry,plan,status,seats,monthly_price,next_billing,created_at,tenant_id').eq('tenant_id', remoteAccount.tenant_id).maybeSingle()
          if (data) remoteBusiness = { id: data.id, businessName: data.business_name, ownerName: data.owner_name, email: data.email, username: data.username, password: data.password, industry: data.industry, plan: data.plan, status: data.status, seats: data.seats, monthlyPrice: data.monthly_price, nextBilling: data.next_billing, createdAt: data.created_at, tenantId: data.tenant_id }
        }
        if (remoteBusiness && businessRequiresActivation(remoteBusiness)) { setBusy(false); setError(remoteBusiness.status === 'Trial' ? 'This business is waiting for site-admin activation.' : 'This business package has expired or is suspended.'); return }
        setError('')
        onBusinessLogin({ id: remoteBusiness?.id || Number(remoteAccount.tenant_id.replace(/[^0-9]/g, '')) || Date.now(), businessName: remoteBusiness?.businessName || remoteAccount.workspace_name, ownerName: remoteBusiness?.ownerName || remoteAccount.owner_name, email: remoteBusiness?.email || `${remoteAccount.username}@biztrack.app`, username: remoteBusiness?.username || remoteAccount.username, password: remoteAccount.password_hash, industry: remoteBusiness?.industry || 'General', plan: remoteBusiness?.plan || 'Starter', status: remoteBusiness?.status || 'Active', seats: remoteBusiness?.seats || 1, monthlyPrice: remoteBusiness?.monthlyPrice || 0, nextBilling: remoteBusiness?.nextBilling || '', createdAt: remoteBusiness?.createdAt || '', tenantId: remoteAccount.tenant_id })
        return
      }
      const { data: workspaceSnapshots } = await supabase.from('workspace_snapshots').select('tenant_id, payload')
      for (const workspace of workspaceSnapshots || []) {
        const snapshot = workspace.payload as Partial<WorkspaceSnapshot>
        const member = (snapshot.members || []).find((item) => item.hasAccount === true && item.username?.trim() && item.password?.trim() && item.username.trim().toLowerCase() === normalizedUser)
        if (!member || !(await verifyPassword(member.password, password))) continue
        const access = snapshot.accessByMember?.[member.id] || []
        if (!access.length) { setBusy(false); setError('Your account has not been assigned any workspace access yet.'); return }
        setError('')
        onBusinessLogin({ id: Number(workspace.tenant_id.replace(/[^0-9]/g, '')) || Date.now(), businessName: snapshot.workspaceName || 'Business workspace', ownerName: 'Workspace owner', email: `${normalizedUser}@biztrack.app`, username: normalizedUser, password: member.password, industry: 'General', plan: 'Starter', status: 'Active', seats: 1, monthlyPrice: 0, nextBilling: '', createdAt: '', tenantId: workspace.tenant_id }, member.id, access)
        return
      }
    }
    setBusy(false)
    setError('Invalid username or password.')
  }
  return <main className="auth-page"><div className="auth-decoration auth-decoration-one"></div><div className="auth-decoration auth-decoration-two"></div><form className="login-card minimal-login" onSubmit={(event) => { event.preventDefault(); if (!busy) void submit() }}><div className="auth-brand"><span className="auth-brand-mark">b</span><strong>biz track</strong></div><h1>Welcome back</h1><p className="auth-copy">Sign in from any device to continue with your synced workspace.</p><label className="login-field"><span>Username</span><input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" placeholder="Your username" required /></label><label className="login-field"><span>Password</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" placeholder="Your password" required /></label>{error && <p className="login-error" role="alert">{error}</p>}<button className="primary-button login-button" type="submit" disabled={busy}>{busy ? 'Checking account...' : 'Sign in'} <span>→</span></button></form></main>
}

// @ts-nocheck
function WorkspaceSettingsPage({ businessName, setBusinessName, currency, setCurrency, paymentMethods, setPaymentMethods, defaultSignIn, defaultSignOut, strictSignIn, allowMultipleDailyShifts, setStrictSignIn, setAllowMultipleDailyShifts, categories, setCategories, setDefaultSignIn, setDefaultSignOut, onChange }: any) { const toggleMethod = (method: string) => setPaymentMethods(paymentMethods.includes(method) ? paymentMethods.filter((item: string) => item !== method) : [...paymentMethods, method]); return <><PageHeading eyebrow="WORKSPACE / SETTINGS" title="Settings" subtitle="Control identity, money, attendance, stock, and account access." /><section className="settings-stack"><article className="panel member-form"><PanelHeading title="Business identity and money" subtitle="These choices are used across the workspace and sales records." /><div className="form-grid"><label><span>Business name</span><input value={businessName} onChange={(event) => { setBusinessName(event.target.value); onChange() }} /></label><label><span>Display currency</span><select value={currency} onChange={(event) => { setCurrency(event.target.value); onChange() }}><option>KES</option><option>USD</option><option>EUR</option></select></label></div><div className="settings-choice-group"><strong>Sales payment methods</strong><small>Choose methods available to cashiers.</small><div className="settings-choice-grid">{['Cash', 'Credit', 'Mobile money'].map((method) => <label key={method} className={paymentMethods.includes(method) ? 'settings-choice enabled' : 'settings-choice'}><input type="checkbox" checked={paymentMethods.includes(method)} onChange={() => { toggleMethod(method); onChange() }} /><span>{method}</span></label>)}</div></div></article><article className="panel member-form"><PanelHeading title="Attendance rules" subtitle="Control daily sign-in behavior and new member schedules." /><div className="form-grid settings-times"><label><span>Default sign-in time</span><input type="time" value={defaultSignIn} onChange={(event) => { setDefaultSignIn(event.target.value); onChange() }} /></label><label><span>Default sign-out time</span><input type="time" value={defaultSignOut} onChange={(event) => { setDefaultSignOut(event.target.value); onChange() }} /></label><label className="settings-checkbox"><input type="checkbox" checked={!allowMultipleDailyShifts} onChange={(event) => { setAllowMultipleDailyShifts(!event.target.checked); onChange() }} /><span><strong>One sign-in per day</strong><small>Prevent a second shift on the same day.</small></span></label><label className="settings-checkbox"><input type="checkbox" checked={strictSignIn} onChange={(event) => { setStrictSignIn(event.target.checked); onChange() }} /><span><strong>Strict sign-in checks</strong><small>Apply schedule checks during sign-in.</small></span></label></div></article><article className="panel member-form"><PanelHeading title="Inventory categories" subtitle="Categories available when recording stock." /><label className="settings-wide-field"><span>Categories</span><input value={categories.join(', ')} onChange={(event) => { setCategories(event.target.value.split(',').map((item: string) => item.trim()).filter(Boolean)); onChange() }} /></label></article><article className="panel member-form"><PanelHeading title="Account and access policy" subtitle="Only account-enabled members appear in Permissions and can sign in." /><div className="settings-policy"><span className="settings-policy-icon">✓</span><div><strong>Owner-controlled access</strong><small>Enable accounts from Add member, then assign pages in Permissions.</small></div></div></article></section></> }

import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import { compare as comparePasswordHash, hash as hashPasswordValue } from 'bcryptjs'

const isBcryptHash = (value: string) => /^\$2[aby]\$\d{2}\$/.test(value)
const verifyPassword = (storedPassword: string, enteredPassword: string) => isBcryptHash(storedPassword) ? comparePasswordHash(enteredPassword, storedPassword) : Promise.resolve(storedPassword === enteredPassword)
const hashPassword = (password: string) => isBcryptHash(password) ? Promise.resolve(password) : hashPasswordValue(password, 12)
const toBase64Url = (value: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(value))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const fromBase64Url = (value: string) => { const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4); return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0)) }
const biometricSupported = () => Boolean(window.isSecureContext && navigator.credentials && window.PublicKeyCredential)
type BiometricBridge = { bridge_url: string; provider: string; model: string; device_identifier: string }
const readBiometricBridge = async (tenantId: string): Promise<BiometricBridge | null> => {
  if (!supabase || !tenantId || tenantId === 'workspace') return null
  const { data, error } = await supabase.from('biometric_devices').select('bridge_url,provider,model,device_identifier').eq('tenant_id', tenantId).eq('enabled', true).not('bridge_url', 'is', null).limit(1).maybeSingle()
  if (error || !data?.bridge_url) return null
  return data as BiometricBridge
}
const callBiometricBridge = async (bridge: BiometricBridge, path: '/enroll' | '/verify', body: Record<string, string>) => {
  const response = await fetch(`${bridge.bridge_url.replace(/\/$/, '')}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!response.ok) throw new Error(`The ${bridge.provider} scanner bridge returned an error.`)
  return response.json() as Promise<{ subjectIdentifier?: string; verified?: boolean }>
}
const ensureOwnerTenantSession = async (username: string, password: string, tenantId?: string) => {
  if (!supabase || !tenantId) return false
  const email = `${username.trim().toLowerCase()}@biztrack.app`
  let { data } = await supabase.auth.getSession()
  if (!data.session) {
    const signedIn = await supabase.auth.signInWithPassword({ email, password })
    data = signedIn.data
    if (!data.session) {
      const signedUp = await supabase.auth.signUp({ email, password })
      data = signedUp.data
    }
  }
  if (!data.session) return false
  const { error } = await supabase.rpc('claim_owner_tenant', { requested_tenant_id: tenantId })
  return !error
}
const showBusinessConfirm = (businessName: string, message: string) => new Promise<boolean>((resolve) => {
  const overlay = document.createElement('div')
  overlay.className = 'business-confirm-backdrop'
  overlay.innerHTML = `<section class="business-confirm-dialog" role="dialog" aria-modal="true"><p class="eyebrow">${businessName}</p><h2>Confirm action</h2><p>${message}</p><div class="business-confirm-actions"><button type="button" data-confirm="cancel" class="secondary-button">Cancel</button><button type="button" data-confirm="ok" class="primary-button">Continue</button></div></section>`
  const finish = (value: boolean) => { overlay.remove(); resolve(value) }
  overlay.addEventListener('click', (event) => { const button = (event.target as HTMLElement).closest('[data-confirm]') as HTMLElement | null; if (button) finish(button.dataset.confirm === 'ok'); if (event.target === overlay) finish(false) })
  document.body.appendChild(overlay)
})
const showBiometricPrompt = (title: string, detail: string) => {
  const overlay = document.createElement('div')
  overlay.className = 'biometric-dialog-backdrop'
  overlay.innerHTML = `<section class="biometric-dialog" role="dialog" aria-modal="true"><div class="biometric-dialog-icon">⌁</div><p class="eyebrow">SECURE ACTION PROOF</p><h2>${title}</h2><p>${detail}</p><div class="biometric-dialog-status">Waiting for device verification...</div></section>`
  document.body.appendChild(overlay)
  return { overlay, status: overlay.querySelector('.biometric-dialog-status') as HTMLElement }
}
async function runBiometricPrompt<T>(title: string, detail: string, operation: () => Promise<T>) {
  const prompt = showBiometricPrompt(title, detail)
  try { const result = await operation(); prompt.overlay.remove(); return result } catch (error) { prompt.status.textContent = error instanceof Error ? error.message : 'Verification was cancelled.'; window.setTimeout(() => prompt.overlay.remove(), 1500); throw error }
}
async function registerBiometric(memberId: number, memberName: string, businessName: string, tenantId: string, owner?: { username: string; password: string }) {
  return runBiometricPrompt('Register worker biometric', `Verify ${memberName} for ${businessName}. This will be used as proof for this worker's attendance actions.`, async () => {
    const bridge = await readBiometricBridge(tenantId)
    if (bridge) {
      const result = await callBiometricBridge(bridge, '/enroll', { memberId: String(memberId), memberName, deviceIdentifier: bridge.device_identifier })
      if (!result.subjectIdentifier) throw new Error('The scanner did not return a worker subject identifier.')
      return result.subjectIdentifier
    }
    if (!biometricSupported()) throw new Error('No scanner bridge is configured, and this browser or device does not support biometric verification. Configure a scanner bridge or use HTTPS with WebAuthn.')
    if (supabase && tenantId && owner) {
      const { data: existingCredentials, error } = await supabase.rpc('list_owner_biometric_credentials', { requested_tenant_id: tenantId, requested_username: owner.username, requested_password: owner.password })
      if (error) throw new Error('Could not check this business biometric registry. Run the latest Supabase SQL migration and try again.')
      const existingCredentialIds = (existingCredentials || []).map((item: { credential_id: string }) => item.credential_id).filter(Boolean)
      if (existingCredentialIds.length) {
        try {
          await navigator.credentials.get({ publicKey: { challenge: crypto.getRandomValues(new Uint8Array(32)), allowCredentials: existingCredentialIds.map((credentialId) => ({ id: fromBase64Url(credentialId), type: 'public-key' as const })), userVerification: 'required', timeout: 60000 } })
          throw new Error('This biometric is already registered in this business. Delete the previous worker before registering it again.')
        } catch (error) {
          if (error instanceof Error && error.message.includes('already registered')) throw error
        }
      }
    }
    const credential = await navigator.credentials.create({ publicKey: { challenge: crypto.getRandomValues(new Uint8Array(32)), rp: { name: businessName }, user: { id: new TextEncoder().encode(String(memberId)), name: memberName, displayName: memberName }, pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }], authenticatorSelection: { userVerification: 'required' }, timeout: 60000 } }) as PublicKeyCredential | null
    if (!credential) throw new Error('Biometric registration was cancelled.')
    return toBase64Url(credential.rawId)
  })
}
async function verifyBiometric(credentialId: string, tenantId: string, action = 'attendance action', businessName = 'your business') {
  return runBiometricPrompt(`Confirm ${action}`, `Verify the registered worker biometric for ${businessName} before this action can be completed.`, async () => {
    const bridge = await readBiometricBridge(tenantId)
    if (bridge) {
      const result = await callBiometricBridge(bridge, '/verify', { subjectIdentifier: credentialId, deviceIdentifier: bridge.device_identifier })
      if (!result.verified) throw new Error('The scanner could not verify this worker.')
      return true
    }
    if (!biometricSupported()) throw new Error('This browser or device does not support biometric verification. Use HTTPS or localhost and try again.')
    const credential = await navigator.credentials.get({ publicKey: { challenge: crypto.getRandomValues(new Uint8Array(32)), allowCredentials: [{ id: fromBase64Url(credentialId), type: 'public-key' }], userVerification: 'required', timeout: 60000 } })
    if (!credential) throw new Error('Biometric verification was cancelled.')
    return true
  })
}
async function saveBiometricRecord(table: 'biometric_credentials' | 'biometric_proofs', values: Record<string, unknown>, owner?: { username: string; password: string }) {
  if (!isSupabaseConfigured || !supabase) return true
  if (table === 'biometric_credentials' && owner) {
    const { error: legacyError } = await supabase.rpc('register_owner_biometric_legacy', {
      requested_tenant_id: values.tenant_id,
      requested_username: owner.username,
      requested_password: owner.password,
      requested_member_id: values.member_id,
      requested_member_name: values.member_name,
      requested_credential_id: values.credential_id,
      requested_registered_at: values.registered_at,
    })
    if (!legacyError) return true
    if (legacyError.message.toLowerCase().includes('already registered') || legacyError.message.toLowerCase().includes('already has a biometric')) throw new Error('This worker already has a biometric in this business. The same biometric can be used in another business.')
  }
  const functionName = table === 'biometric_credentials' ? 'register_biometric_credential' : 'record_biometric_proof'
  const args = table === 'biometric_credentials' ? { requested_tenant_id: values.tenant_id, requested_member_id: values.member_id, requested_member_name: values.member_name, requested_credential_id: values.credential_id, requested_registered_at: values.registered_at } : { requested_tenant_id: values.tenant_id, requested_member_id: values.member_id, requested_action: values.action, requested_credential_id: values.credential_id, requested_verified_at: values.verified_at, requested_attendance_date: values.attendance_date }
  const { error } = await supabase.rpc(functionName, args)
  if (error) {
    if (table === 'biometric_credentials' && (error.code === '23505' || error.message.toLowerCase().includes('already registered') || error.message.toLowerCase().includes('already has a biometric'))) throw new Error('This worker already has a biometric in this business. The same biometric can be used in another business.')
    if (error.message.toLowerCase().includes('tenant access denied')) throw new Error('This business is not yet provisioned for secure storage. Add the owner Auth membership for this tenant, then try again.')
    throw new Error(`Could not save ${table}. Try again.`)
  }
  return true
}
const canTransitionPaymentStatus = (currentStatus: PaymentStatus | undefined, nextStatus: PaymentStatus): boolean => {
  if (!currentStatus) return true
  if (currentStatus === 'Paid') return nextStatus === 'Paid'
  if (currentStatus === 'Pending') return nextStatus === 'Pending' || nextStatus === 'Paid' || nextStatus === 'On hold'
  if (currentStatus === 'On hold') return nextStatus === 'Paid' || nextStatus === 'On hold'
  return true
}

type Role = 'Owner' | 'Manager' | 'Stock Keeper' | 'Cashier' | 'Worker'
type AttendanceStatus = 'Present' | 'Late' | 'Early' | 'Absent' | 'Off'
type PaymentStatus = 'Pending' | 'Paid' | 'On hold'
type Member = { id: number; tenantId?: string; name: string; username: string; password: string; hasAccount?: boolean; biometricCredentialId?: string; phone: string; email: string; department: string; role: Role; initials: string; color: string; payRate: number; payFrequency: PayFrequency; signInTime: string; signOutTime: string }
type OwnerAccount = { name: string; username: string; password: string; business?: string; tenantId?: string; phone?: string; industry?: string; plan?: SubscriptionPlan }
type AttendanceEntry = { memberId: number; date: string; status: AttendanceStatus; checkIn: string; checkOut: string; paymentStatus?: PaymentStatus; biometricProof?: { action: string; verifiedAt: string; credentialId: string } }
type PaymentMethod = 'Cash' | 'Credit' | 'Mobile money'
type Sale = { id: number; amount: number; paymentMethod: PaymentMethod; date: string; time: string; cashier: string }
type InventoryItem = { id: number; name: string; category: string; quantity: number; initialQuantity?: number; unit: string; reorderAt: number }
type Expense = { id: number; inventoryItemId: number; itemName: string; category: string; quantity: number; unit: string; reason: string; date: string; time: string }
type StockMovement = { id: number; type: 'Stocked' | 'Used'; inventoryItemId: number; itemName: string; category: string; quantity: number; unit: string; reason: string; date: string; time: string }
type Deduction = { id: number; memberId: number; amount: number; reason: string; date: string }
type AccessArea = 'Overview' | 'Attendance' | 'Payroll' | 'Deductions' | 'Penalties' | 'Departments' | 'Inventory' | 'Sales' | 'Team' | 'OFF MARK' | 'Print' | 'ROLL' | 'Settings'
type SubscriptionPlan = string
type SubscriptionStatus = 'Trial' | 'Active' | 'Paused' | 'Canceled'
type BusinessAccount = {
  id: number
  businessName: string
  ownerName: string
  email: string
  username: string
  password: string
  industry: string
  plan: SubscriptionPlan
  status: SubscriptionStatus
  seats: number
  monthlyPrice: number
  nextBilling: string
  createdAt: string
  tenantId: string
}
type RegistrationRequest = { id: number; applicantName: string; businessName: string; issue: string; submittedAt: string; phone?: string; email?: string; username?: string; password?: string; industry?: string; plan?: SubscriptionPlan; reviewStatus?: 'Pending' | 'Activated' | 'Declined' }
type ActivationCode = { id: number; code: string; packageName: SubscriptionPlan; status: 'Available' | 'Used'; createdAt: string; usedBy?: string }
type PackageConfig = { name: SubscriptionPlan; price: number; seats: number; duration: number; durationUnit: 'day' | 'week' | 'month' | 'year'; description: string; features: string[]; active: boolean }
type WorkspaceSession = { username: string; tenant_id: string; workspace_name: string; owner_name: string; password_hash: string; updated_at: string }

const roles: Role[] = ['Owner', 'Manager', 'Stock Keeper', 'Cashier', 'Worker']
const uniqueAccessAreas: AccessArea[] = ['Overview', 'Attendance', 'Payroll', 'Deductions', 'Penalties', 'Departments', 'Inventory', 'Sales', 'Team', 'OFF MARK', 'Print', 'ROLL', 'Settings']
const accessAreas: AccessArea[] = Array.from(new Set(uniqueAccessAreas)) as AccessArea[]
const navItems = [{ label: 'Overview', icon: '◈' }, { label: 'Sales', icon: '↗' }, { label: 'Attendance', icon: '◷' }, { label: 'Payroll', icon: 'KES' }, { label: 'Deductions', icon: '−' }, { label: 'Inventory', icon: '□' }, { label: 'Departments', icon: '▦' }, { label: 'OFF MARK', icon: '◉' }, { label: 'Print', icon: '▤' }]
const sidebarGroups = [
  { label: '', links: ['Overview'] },
  { label: 'OPERATIONS', links: ['Sales', 'Attendance', 'Payroll', 'Deductions', 'Inventory'] },
  { label: 'PEOPLE', links: ['Team', 'Permissions', 'Departments'] },
  { label: 'REPORTS', links: ['OFF MARK', 'Print'] },
  { label: 'SYSTEM', links: ['ROLL', 'Settings'] },
]
const localDateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const today = localDateKey(new Date())
const formatDate = (value: string) => {
  const parts = value.slice(0, 10).split('-')
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : value
}
function datesBetween(start: string, end: string) {
  const dates: string[] = []
  const cursor = new Date(`${start}T00:00:00`)
  const last = new Date(`${end}T00:00:00`)
  while (cursor <= last) {
    dates.push(localDateKey(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return dates
}
const currentMonthStart = `${today.slice(0, 7)}-01`
const currentWeekStartDate = new Date(`${today}T00:00:00`)
const currentWeekDay = currentWeekStartDate.getDay()
currentWeekStartDate.setDate(currentWeekStartDate.getDate() - (currentWeekDay === 0 ? 6 : currentWeekDay - 1))
const currentWeekStart = localDateKey(currentWeekStartDate)
const currentWeekEndDate = new Date(currentWeekStartDate)
currentWeekEndDate.setDate(currentWeekEndDate.getDate() + 6)
const currentWeekEnd = localDateKey(currentWeekEndDate)
const planPrices: Record<string, number> = { Starter: 29, Growth: 79, Scale: 149 }
const packageFeatures = ['Sales and revenue tracking', 'Team and permissions', 'Attendance and payroll', 'Inventory and stock', 'Reports and printing', 'Departments and roles']
const defaultPackages: PackageConfig[] = [{ name: 'Starter', price: 29, seats: 5, duration: 1, durationUnit: 'month', description: 'For a small team getting started.', features: ['Sales and revenue tracking', 'Team and permissions'], active: true }, { name: 'Growth', price: 79, seats: 12, duration: 1, durationUnit: 'month', description: 'For growing businesses and teams.', features: ['Sales and revenue tracking', 'Team and permissions', 'Attendance and payroll', 'Inventory and stock'], active: true }, { name: 'Scale', price: 149, seats: 30, duration: 1, durationUnit: 'month', description: 'For larger operations with more seats.', features: packageFeatures, active: true }]
const normalizePackages = (stored: Partial<PackageConfig>[] | null) => (stored?.length ? stored : defaultPackages).map((item) => ({ ...item, name: item.name || 'Package', price: Number(item.price) || 0, seats: Number(item.seats) || 1, duration: Number(item.duration) || 1, durationUnit: item.durationUnit === 'year' || item.durationUnit === 'month' || item.durationUnit === 'week' || item.durationUnit === 'day' ? item.durationUnit : 'month', description: item.description || '', features: Array.isArray(item.features) ? item.features : [], active: item.active !== false })) as PackageConfig[]
const defaultBusinessAccounts: BusinessAccount[] = [
  { id: 1, businessName: 'Sierra Bistro', ownerName: 'Aisha Musa', email: 'aisha@sierra-bistro.com', username: 'aisha', password: 'admin123', industry: 'Hospitality', plan: 'Growth', status: 'Active', seats: 18, monthlyPrice: planPrices.Growth, nextBilling: '2026-10-12', createdAt: '2026-08-15', tenantId: 'tenant-sierra' },
  { id: 2, businessName: 'Summit Retail', ownerName: 'Kevin Tate', email: 'kevin@summit-retail.com', username: 'kevin', password: 'admin123', industry: 'Retail', plan: 'Starter', status: 'Trial', seats: 6, monthlyPrice: planPrices.Starter, nextBilling: '2026-09-28', createdAt: '2026-09-10', tenantId: 'tenant-summit' },
  { id: 3, businessName: 'Harbor Build', ownerName: 'Lina Brooks', email: 'lina@harborbuild.co', username: 'lina', password: 'admin123', industry: 'Construction', plan: 'Scale', status: 'Paused', seats: 32, monthlyPrice: planPrices.Scale, nextBilling: '2026-10-03', createdAt: '2026-07-01', tenantId: 'tenant-harbor' },
]
const pagePaths: Record<string, string> = { Welcome: '/welcome/', Terms: '/terms/', Master: '/master/', Register: '/register/', 'Sign in': '/signin/', 'Register site admin': '/admin-register/', Admin: '/admin/', 'Admin sign in': '/admin-signin/', Delete: '/delete/', Dashboard: '/admin/', Business: '/admin/businesses/', Users: '/admin/users/', 'Register a new business': '/admin/register/', 'Activation codes': '/admin/activation-codes/', Packages: '/admin/packages/', 'Activate business': '/admin/activate-business/', 'Admin settings': '/admin/settings/', Overview: '/master/dashboard/', Sales: '/master/sales/', Attendance: '/master/attendance/', Payroll: '/master/payroll/', Deductions: '/master/deductions/', Penalties: '/master/penalties/', Departments: '/master/departments/', Inventory: '/master/inventory/', Team: '/master/team/', 'Add member': '/add/', Permissions: '/master/permissions/', Settings: '/master/settings/', 'OFF MARK': '/master/offmark/', Print: '/master/print/', ROLL: '/master/roll/', 'Worker sign-in': '/master/roll/sign-in/', 'Worker checkout': '/master/roll/sign-out/' }
const visiblePageName = (page: string) => page
const timeToMinutes = (value: string) => { const [hours, minutes] = value.split(':').map(Number); return (hours || 0) * 60 + (minutes || 0) }
const grantPagePaths: Record<string, string> = Object.fromEntries(Object.keys(pagePaths).filter((page) => pagePaths[page].startsWith('/master/')).map((page) => [page, `/grant/${page.toLowerCase().replace(/[^a-z0-9]+/g, '-')}/`]))
const pathPages: Record<string, string> = Object.fromEntries([...Object.entries(pagePaths), ...Object.entries(grantPagePaths)].map(([page, path]) => [path, page]))
pathPages['/master/departments/add'] = 'Departments'
const defaultSiteAdminAccount: OwnerAccount = { name: 'Platform admin', username: 'muli@track12', password: 'muli@track12', business: 'Biz Track HQ' }
const siteAdminAccountKey = 'biztrack-site-admin-account'
const readStoredSiteAdminAccount = (): OwnerAccount => {
  try { return JSON.parse(localStorage.getItem(siteAdminAccountKey) || 'null') || defaultSiteAdminAccount } catch { return defaultSiteAdminAccount }
}
const businessPackageExpired = (account: BusinessAccount) => Boolean(account.nextBilling && account.nextBilling < today)
const businessRequiresActivation = (account: BusinessAccount) => account.status !== 'Active' || businessPackageExpired(account)
const pageForPath = (path: string) => {
  const cleaned = (path || '/').replace(/\/$/, '') || '/'
  if (cleaned === '/add') return 'Add member'
  if (cleaned === '/' || cleaned === '/welcome') return 'Welcome'
  if (cleaned === '/terms') return 'Terms'
  if (cleaned === '/signin') return 'Sign in'
  if (cleaned === '/register') return 'Register'
  if (cleaned === '/admin-signin') return 'Admin sign in'
  if (cleaned === '/grant') return 'Overview'
  if (cleaned.startsWith('/admin')) return pathPages[cleaned] || pathPages[cleaned + '/'] || 'Admin'
  return pathPages[cleaned] || pathPages[cleaned + '/'] || 'Welcome'
}
async function persistSharedWorkspaceSession(account: Pick<BusinessAccount, 'username' | 'password' | 'tenantId' | 'businessName' | 'ownerName'>) {
  if (!isSupabaseConfigured || !supabase || !account.tenantId || !account.username) return
  const username = account.username.trim().toLowerCase()
  await supabase.from('workspace_sessions').upsert({
    username,
    tenant_id: account.tenantId,
    workspace_name: account.businessName.trim(),
    owner_name: account.ownerName.trim(),
    password_hash: account.password,
    updated_at: new Date().toISOString(),
  })
}
function initialsFor(name: string) { return name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('') }
function businessNameParts(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return ['', '']
  if (words.length <= 2) return [words.join(' '), '']

  const andIndex = words.findIndex((word) => word.toUpperCase() === 'AND')
  if (andIndex > 0 && andIndex < words.length - 1) {
    const first = words.slice(0, andIndex + 1).join(' ')
    const second = words.slice(andIndex + 1).join(' ')
    if (first.length <= 26 && second.length <= 26) return [first, second]
  }

  if (words.length === 3) return [words.slice(0, 2).join(' '), words[2]]

  const split = Math.ceil(words.length / 2)
  const first = words.slice(0, split).join(' ')
  const second = words.slice(split).join(' ')

  if (first.length <= 26 && second.length <= 26) return [first, second]
  return [first, second]
}
function normalizeMember(member: Partial<Member>, index: number, tenantId = 'workspace'): Member { const name = member.name || 'Unnamed member'; return { ...member, tenantId: member.tenantId || tenantId, id: member.id || Date.now() + index, name, username: member.username || '', password: member.password || '', hasAccount: member.hasAccount === true && Boolean(member.username?.trim() && member.password?.trim()), phone: member.phone || 'NA', email: member.email || 'NA', department: member.department || 'Unassigned', role: member.role || 'Worker', initials: member.initials || initialsFor(name), color: member.color || 'mint', payRate: member.payRate || 1000, payFrequency: member.payFrequency || 'Daily', signInTime: member.signInTime || '08:00', signOutTime: member.signOutTime || '17:00' } as Member }
function whatsappHelpUrl(businessName: string, owner: OwnerAccount | null, members: Member[], sessionMemberId: number, whatsappNumber: string) {
  let number = whatsappNumber.replace(/[^0-9]/g, '')
    if (number.startsWith('00')) number = number.slice(2)
    if (number.startsWith('0')) number = `254${number.slice(1)}`
    if (!number) return ''
    const member = members.find((item) => item.id === sessionMemberId)
    const isOwner = sessionMemberId === -1 || (!member && Boolean(owner))
    const personName = isOwner ? owner?.name || 'Owner' : member?.name || 'Member'
    const department = isOwner ? 'Owner' : member?.department || 'Unassigned'
    const message = `Hello, I need help with my Biz Track workspace.\nName: ${personName}\nDepartment: ${department}\nBusiness: ${businessName}`
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`
}
const readStoredWhatsappNumber = () => {
  try { return localStorage.getItem('biztrack-whatsapp-number') || '' } catch { return '' }
}
const emptyAccess: Record<number, AccessArea[]> = {}
type WorkspaceSnapshot = {
  members: Member[]
  departmentList: string[]
  attendance: AttendanceEntry[]
  sales: Sale[]
  salesHistory: Sale[]
  deductions: Deduction[]
  expenses: Expense[]
  stockMovements: StockMovement[]
  inventory: InventoryItem[]
  storeCategories: string[]
  categoryUnits: Record<string, string>
  categoryThresholds: Record<string, number>
  workspaceName: string
  currency: string
  paymentMethods: string[]
  strictSignIn: boolean
  allowMultipleDailyShifts: boolean
  biometricSignIn: boolean
  biometricSignOut: boolean
  biometricMark: boolean
  biometricPayroll: boolean
  defaultSignIn: string
  defaultSignOut: string
  lateSignIn: string
  earlySignOut: string
  accessByMember: Record<number, AccessArea[]>
}
type PlatformSettings = { platformName: string; supportEmail: string; whatsappNumber: string; defaultPlan: SubscriptionPlan; maintenanceMode: boolean }
const defaultPlatformSettings: PlatformSettings = { platformName: 'Biz Track', supportEmail: 'support@biztrack.app', whatsappNumber: '', defaultPlan: 'Starter', maintenanceMode: false }
type RefreshSession = { owner?: OwnerAccount; memberId?: number; siteAdmin?: boolean; path?: string }
const refreshSessionKey = 'biztrack-refresh-session'
const readRefreshSession = (): RefreshSession | null => {
  try { return JSON.parse(localStorage.getItem(refreshSessionKey) || 'null') as RefreshSession | null } catch { return null }
}
const saveRefreshSession = (session: RefreshSession | null) => {
  if (session) localStorage.setItem(refreshSessionKey, JSON.stringify(session))
  else localStorage.removeItem(refreshSessionKey)
}

function WorkspaceLoadingPage({ businessName }: { businessName: string }) {
  return <main className="workspace-loading"><header className="workspace-loading-topbar"><div className="workspace-loading-brand"><span className="workspace-loading-dot"></span><strong>{businessName || 'Your workspace'}</strong></div><span className="workspace-loading-status">Loading workspace</span></header><div className="workspace-loading-content"><div className="workspace-loading-heading"><span className="loading-block loading-kicker"></span><span className="loading-block loading-title"></span><span className="loading-block loading-subtitle"></span></div><section className="workspace-loading-metrics">{[1, 2, 3, 4].map((item) => <div className="workspace-loading-card" key={item}><span className="loading-block loading-label"></span><span className="loading-block loading-value"></span><span className="loading-block loading-line"></span></div>)}</section><section className="workspace-loading-panel"><div className="workspace-loading-panel-head"><span className="loading-block loading-panel-title"></span><span className="loading-block loading-filter"></span></div>{[1, 2, 3, 4, 5].map((item) => <div className="workspace-loading-row" key={item}><span className="loading-block loading-avatar"></span><span className="loading-block loading-name"></span><span className="loading-block loading-cell"></span><span className="loading-block loading-cell"></span><span className="loading-block loading-status"></span></div>)}</section></div></main>
}

function App() {
  const initialRefreshSession = readRefreshSession()
  const [activeNav, setActiveNav] = useState(() => pageForPath(window.location.pathname) || (initialRefreshSession?.path ? pageForPath(initialRefreshSession.path) : 'Welcome'))
  useEffect(() => {
    const preventNumberWheelChange = (event: WheelEvent) => {
      const target = event.target as HTMLElement
      if (target instanceof HTMLInputElement && target.type === 'number' && document.activeElement === target) event.preventDefault()
    }
    document.addEventListener('wheel', preventNumberWheelChange, { capture: true, passive: false })
    return () => document.removeEventListener('wheel', preventNumberWheelChange, true)
  }, [])
  useEffect(() => {
    if (activeNav === 'Welcome' && window.location.pathname !== pagePaths.Welcome) window.history.replaceState({}, '', pagePaths.Welcome)
    if (activeNav === 'Sign in' && window.location.pathname !== pagePaths['Sign in']) window.history.replaceState({}, '', pagePaths['Sign in'])
  }, [activeNav])
    const [role, setRole] = useState<Role>('Worker')
    const isOnline = true
    const syncLabel = 'Online only'
    const [attendanceNotice, setAttendanceNotice] = useState('')
      const [attendanceNoticeTone, setAttendanceNoticeTone] = useState<'success' | 'error'>('success')
    const [ownerAccount, setOwnerAccount] = useState<OwnerAccount | null>(initialRefreshSession?.owner || null)
    const [siteAdminAccount, setSiteAdminAccount] = useState<OwnerAccount | null>(readStoredSiteAdminAccount)
    const [siteAdminSession, setSiteAdminSession] = useState(initialRefreshSession?.siteAdmin === true)
    const [businessAccounts, setBusinessAccounts] = useState<BusinessAccount[]>([])
    const [registrationRequests, setRegistrationRequests] = useState<RegistrationRequest[]>([])
    const [reviewDecisions, setReviewDecisions] = useState<Record<string, 'Activated' | 'Declined'>>(() => { try { return JSON.parse(localStorage.getItem('biztrack-review-decisions') || '{}') } catch { return {} } })
    const [activationCodes, setActivationCodes] = useState<ActivationCode[]>([])
    const [packages, setPackages] = useState<PackageConfig[]>(defaultPackages)
    const [platformSettings, setPlatformSettings] = useState<PlatformSettings>(defaultPlatformSettings)
    const [maintenanceMode, setMaintenanceMode] = useState(false)
    const [platformSettingsReady, setPlatformSettingsReady] = useState(!isSupabaseConfigured)
    const [supabaseReady, setSupabaseReady] = useState(!isSupabaseConfigured)
    const [siteAdminReady, setSiteAdminReady] = useState(!isSupabaseConfigured)
    const tenantId = ownerAccount?.tenantId || 'workspace'
    const [members, setMembers] = useState<Member[]>([])
    const [departmentList, setDepartmentList] = useState<string[]>([])
    const [attendance, setAttendance] = useState<AttendanceEntry[]>([])
    const [sales, setSales] = useState<Sale[]>([])
    const [salesHistory, setSalesHistory] = useState<Sale[]>([])
    const [deductions, setDeductions] = useState<Deduction[]>([])
    const [expenses, setExpenses] = useState<Expense[]>([])
    const [stockMovements, setStockMovements] = useState<StockMovement[]>([])
    const [inventory, setInventory] = useState<InventoryItem[]>([])
    const [storeCategories, setStoreCategories] = useState<string[]>([])
    const [categoryUnits, setCategoryUnits] = useState<Record<string, string>>({})
      const [categoryThresholds, setCategoryThresholds] = useState<Record<string, number>>({})
    const [workspaceName, setWorkspaceName] = useState(() => ownerAccount?.business || '')
    const [currency, setCurrency] = useState('KES')
    const [paymentMethods, setPaymentMethods] = useState<string[]>(['Cash', 'Credit', 'Mobile money'])
      const [strictSignIn, setStrictSignIn] = useState(false)
  const [allowMultipleDailyShifts, setAllowMultipleDailyShifts] = useState(false)
      const [biometricSignIn, setBiometricSignIn] = useState(false)
      const [biometricSignOut, setBiometricSignOut] = useState(false)
      const [biometricMark, setBiometricMark] = useState(false)
      const [biometricPayroll, setBiometricPayroll] = useState(false)
  const [defaultSignIn, setDefaultSignIn] = useState('08:00')
  const [defaultSignOut, setDefaultSignOut] = useState('17:00')
  const [lateSignIn, setLateSignIn] = useState('08:00')
  const [earlySignOut, setEarlySignOut] = useState('17:00')
  const [isCheckedIn, setIsCheckedIn] = useState(true)
    const [sessionMemberId, setSessionMemberId] = useState(initialRefreshSession?.memberId || 0)
  const [accessByMember, setAccessByMember] = useState<Record<number, AccessArea[]>>(emptyAccess)
  const [accountChoiceOpen, setAccountChoiceOpen] = useState(false)
  const [selectingExistingAccount, setSelectingExistingAccount] = useState(false)
  const [permissionTargetId, setPermissionTargetId] = useState<number | null>(null)
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null)
  const [loadedTenantId, setLoadedTenantId] = useState(tenantId)
  const [remoteWorkspaceLoaded, setRemoteWorkspaceLoaded] = useState(!isSupabaseConfigured || tenantId === 'workspace')
  const [startupReady, setStartupReady] = useState(!isSupabaseConfigured)
  const workspaceHydrationId = useRef(0)
  const workspaceSaveTimer = useRef<number | null>(null)
  const workspaceSaveVersion = useRef(0)
  const workspaceSaveQueue = useRef(Promise.resolve())
  useEffect(() => {
    const preventNumberWheel = (event: WheelEvent) => {
      const target = event.target as HTMLInputElement | null
      if (target?.matches('input[type="number"]')) event.preventDefault()
    }
    document.addEventListener('wheel', preventNumberWheel, { capture: true, passive: false })
    return () => document.removeEventListener('wheel', preventNumberWheel, true)
  }, [])

  useEffect(() => {
    const path = window.location.pathname.replace(/\/$/, '') || '/'
    const adminSession = siteAdminSession
    const owner = ownerAccount
    const hasWorkspaceSession = Boolean(owner && sessionMemberId !== 0)

    if (path.startsWith('/master') && !hasWorkspaceSession) {
      setActiveNav('Sign in')
      window.history.replaceState({}, '', pagePaths['Sign in'])
      return
    }

    if (path.startsWith('/admin') && !adminSession) {
      setActiveNav('Admin sign in')
      window.history.replaceState({}, '', pagePaths['Admin sign in'])
    }
  }, [ownerAccount, sessionMemberId, siteAdminSession])

  useEffect(() => {
    if (activeNav !== 'Inventory') return
    const select = document.querySelector('.sales-form select[name="category"]') as HTMLSelectElement | null
    if (!select) return
    select.replaceChildren(new Option(storeCategories.length ? 'Select a category' : 'Add categories in Settings first', ''))
    storeCategories.forEach((item) => select.add(new Option(item, item)))
    select.disabled = storeCategories.length === 0
    select.required = true
  }, [activeNav, storeCategories])
  useEffect(() => {
    if (activeNav !== 'Inventory') return
    const categorySelect = document.querySelector('.sales-form select[name="category"]') as HTMLSelectElement | null
    const unitInput = document.querySelector('.sales-form input[name="unit"]') as HTMLInputElement | null
    const thresholdInput = document.querySelector('.sales-form input[name="reorderAt"]') as HTMLInputElement | null
    if (!categorySelect || !unitInput || !thresholdInput) return
    const syncUnit = () => { unitInput.value = categoryUnits[categorySelect.value] || 'pieces'; unitInput.readOnly = true; thresholdInput.value = String(categoryThresholds[categorySelect.value] ?? 5); thresholdInput.readOnly = true }
    categorySelect.addEventListener('change', syncUnit)
    syncUnit()
    return () => categorySelect.removeEventListener('change', syncUnit)
  }, [activeNav, storeCategories, categoryUnits, categoryThresholds])
  useEffect(() => {
    if (activeNav !== 'Settings') return
    const field = document.querySelector('.settings-wide-field') as HTMLElement | null
    const input = field?.querySelector('input') as HTMLInputElement | null
    if (!field || !input) return
    let draft = storeCategories.join('\n')
    const textarea = document.createElement('textarea')
    textarea.rows = 4
    textarea.value = draft
    textarea.placeholder = 'One category per line'
    textarea.addEventListener('input', () => { draft = textarea.value })
    textarea.className = 'category-editor-input'
    input.replaceWith(textarea)
  }, [activeNav])
  useEffect(() => {
    if (activeNav !== 'Settings') return
    const field = document.querySelector('.settings-wide-field') as HTMLElement | null
    const textarea = field?.querySelector('textarea')
    if (!field || !textarea || field.querySelector('.category-unit-list')) return
    field.classList.add('category-settings-field')
    const unitList = document.createElement('div')
    unitList.className = 'category-unit-list'
    const appendCategoryRow = (category: string, unitValue = categoryUnits[category] || 'pieces', thresholdValue = categoryThresholds[category] ?? 5) => {
      const row = document.createElement('div')
      row.className = 'category-unit-row'
      row.dataset.originalCategory = category
      const name = document.createElement('input')
      name.type = 'text'
      name.value = category
      name.placeholder = 'Category name'
      name.className = 'category-name-input'
      const unit = document.createElement('input')
      unit.type = 'text'
      unit.value = unitValue
      unit.placeholder = 'kg, litres, sacks'
      unit.className = 'category-unit-input'
      const threshold = document.createElement('input')
      threshold.type = 'number'
      threshold.min = '0'
      threshold.value = String(thresholdValue)
      threshold.placeholder = 'Threshold'
      threshold.className = 'category-threshold-input'
      const remove = document.createElement('button')
      remove.type = 'button'
      remove.className = 'category-delete-button'
      remove.textContent = 'Delete'
      remove.addEventListener('click', () => row.remove())
      row.append(name, unit, threshold, remove)
      unitList.appendChild(row)
    }
    storeCategories.forEach((category) => appendCategoryRow(category))
    const addCategory = document.createElement('button')
    addCategory.type = 'button'
    addCategory.className = 'secondary-button category-add-button'
    addCategory.textContent = '+ Add category'
    addCategory.addEventListener('click', () => { appendCategoryRow('New category'); unitList.lastElementChild?.querySelector('input')?.focus() })
    const saveUnits = document.createElement('button')
    saveUnits.type = 'button'
    saveUnits.className = 'secondary-button'
    saveUnits.textContent = 'Save changes'
    saveUnits.addEventListener('click', () => {
      const nextUnits: Record<string, string> = {}
      const nextThresholds: Record<string, number> = {}
      const renamedCategories: Record<string, string> = {}
      const nextCategories: string[] = []
      unitList.querySelectorAll('.category-unit-row').forEach((row) => { const name = row.querySelector('.category-name-input') as HTMLInputElement; const unit = row.querySelector('.category-unit-input') as HTMLInputElement; const threshold = row.querySelector('.category-threshold-input') as HTMLInputElement; const category = name.value.trim(); if (!category || nextCategories.includes(category)) return; nextCategories.push(category); nextUnits[category] = unit.value.trim() || 'pieces'; nextThresholds[category] = Math.max(0, Number(threshold.value || 0)); renamedCategories[row.dataset.originalCategory || category] = category })
      setStoreCategories(nextCategories)
      setCategoryUnits(nextUnits)
      setCategoryThresholds(nextThresholds)
      setInventory((current) => current.map((item) => { const category = renamedCategories[item.category] || item.category; return nextCategories.includes(category) ? { ...item, category, unit: nextUnits[category] || item.unit, reorderAt: nextThresholds[category] ?? item.reorderAt } : item }))
      markChanged()
      navigate('Inventory')
    })
    textarea.style.display = 'none'
    textarea.insertAdjacentElement('afterend', unitList)
    unitList.insertAdjacentElement('beforebegin', addCategory)
    unitList.insertAdjacentElement('afterend', saveUnits)
  }, [activeNav, storeCategories, categoryUnits, categoryThresholds])

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return
    let cancelled = false
    const loadAdminData = async () => {
      const [{ data: accounts }, { data: requests }, { data: hostedAdmin }, { data: platform }, { data: siteSnapshot }] = await Promise.all([
        supabase.from('business_accounts').select('*').order('created_at', { ascending: false }),
        supabase.from('registration_requests').select('*').order('id', { ascending: false }),
        supabase.from('site_admin_accounts').select('*').eq('id', 1).maybeSingle(),
        supabase.from('platform_settings').select('*').eq('id', 1).maybeSingle(),
        supabase.from('site_admin_snapshots').select('payload').eq('id', 1).maybeSingle(),
      ])
      if (cancelled) return
      if (accounts?.length) setBusinessAccounts(accounts.map((account: any) => ({ id: account.id, businessName: account.business_name, ownerName: account.owner_name, email: account.email, username: account.username, password: account.password, industry: account.industry, plan: account.plan, status: account.status, seats: account.seats, monthlyPrice: account.monthly_price, nextBilling: account.next_billing, createdAt: account.created_at, tenantId: account.tenant_id })))
      else if (ownerAccount?.tenantId && ownerAccount.username && ownerAccount.password) {
        const legacyAccount: BusinessAccount = { id: Number(ownerAccount.tenantId.replace(/[^0-9]/g, '')) || Date.now(), businessName: ownerAccount.business || 'BizTrack workspace', ownerName: ownerAccount.name, email: ownerAccount.email || `${ownerAccount.username}@biztrack.app`, username: ownerAccount.username, password: ownerAccount.password, industry: ownerAccount.industry || 'General', plan: ownerAccount.plan || 'Starter', status: 'Active', seats: 5, monthlyPrice: planPrices[ownerAccount.plan || 'Starter'] || planPrices.Starter, nextBilling: today, createdAt: today, tenantId: ownerAccount.tenantId }
        setBusinessAccounts([legacyAccount])
        await supabase.from('business_accounts').upsert({ id: legacyAccount.id, business_name: legacyAccount.businessName, owner_name: legacyAccount.ownerName, email: legacyAccount.email, username: legacyAccount.username, password: legacyAccount.password, industry: legacyAccount.industry, plan: legacyAccount.plan, status: legacyAccount.status, seats: legacyAccount.seats, monthly_price: legacyAccount.monthlyPrice, next_billing: legacyAccount.nextBilling, created_at: legacyAccount.createdAt, tenant_id: legacyAccount.tenantId })
      }
      if (requests?.length) setRegistrationRequests(requests.map((request: any) => ({ id: request.id, applicantName: request.applicant_name, businessName: request.business_name, issue: request.issue, submittedAt: request.submitted_at, phone: request.phone, email: request.email, username: request.username, password: request.password, industry: request.industry, plan: request.plan, reviewStatus: request.review_status })))
      if (hostedAdmin) {
        const canonicalAdmin = { ...defaultSiteAdminAccount, name: hostedAdmin.name || defaultSiteAdminAccount.name, username: hostedAdmin.username || defaultSiteAdminAccount.username, password: hostedAdmin.password || defaultSiteAdminAccount.password, business: hostedAdmin.business || defaultSiteAdminAccount.business }
        setSiteAdminAccount(canonicalAdmin)
        localStorage.setItem(siteAdminAccountKey, JSON.stringify(canonicalAdmin))
        if (hostedAdmin.username !== canonicalAdmin.username || hostedAdmin.password !== canonicalAdmin.password) await supabase.from('site_admin_accounts').upsert({ id: 1, name: canonicalAdmin.name, username: canonicalAdmin.username, password: canonicalAdmin.password, business: canonicalAdmin.business })
      }
      if (platform) {
        const nextPlatformSettings = { platformName: platform.platform_name || defaultPlatformSettings.platformName, supportEmail: platform.support_email || defaultPlatformSettings.supportEmail, whatsappNumber: platform.whatsapp_number || '', defaultPlan: platform.default_plan || defaultPlatformSettings.defaultPlan, maintenanceMode: platform.maintenance_mode ?? false }
        setPlatformSettings(nextPlatformSettings)
        localStorage.setItem('biztrack-whatsapp-number', nextPlatformSettings.whatsappNumber)
        setMaintenanceMode(nextPlatformSettings.maintenanceMode)
      }
      const siteData = siteSnapshot?.payload as { registrationRequests?: RegistrationRequest[]; activationCodes?: ActivationCode[]; packages?: Partial<PackageConfig>[]; reviewDecisions?: Record<string, 'Activated' | 'Declined'> } | undefined
      if (siteData?.registrationRequests) setRegistrationRequests(siteData.registrationRequests)
      if (siteData?.reviewDecisions) setReviewDecisions(siteData.reviewDecisions)
      if (siteData?.activationCodes) setActivationCodes(siteData.activationCodes)
      if (siteData?.packages) setPackages(normalizePackages(siteData.packages))
      setPlatformSettingsReady(true)
      setSupabaseReady(true)
      setSiteAdminReady(true)
    }
    void loadAdminData().catch(() => { setSupabaseReady(true); setSiteAdminReady(true) })
    return () => { cancelled = true }
  }, [])
  useEffect(() => {
    if (!isSupabaseConfigured) { setStartupReady(true); return }
    const workspaceReady = !ownerAccount || sessionMemberId === 0 || remoteWorkspaceLoaded
    if (platformSettingsReady && siteAdminReady && supabaseReady && workspaceReady) setStartupReady(true)
  }, [ownerAccount, sessionMemberId, platformSettingsReady, siteAdminReady, supabaseReady, remoteWorkspaceLoaded])
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return
    const refreshMaintenance = async () => {
      const { data } = await supabase.from('platform_settings').select('maintenance_mode').eq('id', 1).maybeSingle()
      if (data?.maintenance_mode !== undefined) { setMaintenanceMode(data.maintenance_mode); setPlatformSettings((current) => ({ ...current, maintenanceMode: data.maintenance_mode })) }
      setPlatformSettingsReady(true)
    }
    const timer = window.setInterval(() => { void refreshMaintenance() }, 10000)
    return () => window.clearInterval(timer)
  }, [])
  useEffect(() => {
    if (!attendanceNotice) return
    const notice = document.createElement('div')
    notice.className = `attendance-success ${attendanceNoticeTone === 'error' ? 'attendance-error' : ''}`
    const message = document.createElement('span')
    message.textContent = attendanceNotice
    const close = document.createElement('button')
    close.type = 'button'
    close.className = 'attendance-success-close'
    close.setAttribute('aria-label', 'Dismiss notification')
    close.textContent = '×'
    close.addEventListener('click', () => setAttendanceNotice(''))
    notice.append(message, close)
    document.body.appendChild(notice)
    const timer = window.setTimeout(() => setAttendanceNotice(''), 3000)
    return () => { window.clearTimeout(timer); notice.remove() }
  }, [attendanceNotice, attendanceNoticeTone])
  useEffect(() => {
    if (loadedTenantId === tenantId) return
    setLoadedTenantId(tenantId)
  }, [tenantId])
  useEffect(() => {
    if (!supabase || tenantId === 'workspace') {
      setRemoteWorkspaceLoaded(true)
      return
    }
    setRemoteWorkspaceLoaded(false)
    const hydrationId = workspaceHydrationId.current + 1
    workspaceHydrationId.current = hydrationId
    let cancelled = false
    const loadWorkspaceSnapshot = async () => {
      const [{ data, error }, { data: biometrics }, { data: canonicalBusiness }] = await Promise.all([
        supabase.from('workspace_snapshots').select('payload').eq('tenant_id', tenantId).maybeSingle(),
        supabase.rpc('list_biometric_credentials', { requested_tenant_id: tenantId }),
        supabase.from('business_accounts').select('business_name').eq('tenant_id', tenantId).maybeSingle(),
      ])
      if (cancelled || hydrationId !== workspaceHydrationId.current) return
      if (error) throw error
      const snapshot = data?.payload as Partial<WorkspaceSnapshot> | undefined
      const biometricIds = new Map((biometrics || []).map((item: { member_id: number; credential_id: string }) => [item.member_id, item.credential_id]))
      const snapshotIsComplete = Boolean(snapshot && ('members' in snapshot || 'attendance' in snapshot || 'workspaceName' in snapshot))
      if (snapshotIsComplete && snapshot) {
        if ('members' in snapshot) setMembers((snapshot.members || []).map((member, index) => normalizeMember({ ...member, biometricCredentialId: biometricIds.get(member.id) || '' }, index, tenantId)))
        if ('departmentList' in snapshot) setDepartmentList(snapshot.departmentList || [])
        if ('attendance' in snapshot) setAttendance(snapshot.attendance || [])
        if ('sales' in snapshot) setSales(snapshot.sales || [])
        if ('salesHistory' in snapshot) setSalesHistory(snapshot.salesHistory || [])
        if ('deductions' in snapshot) setDeductions(snapshot.deductions || [])
        if ('expenses' in snapshot) setExpenses(snapshot.expenses || [])
        if ('stockMovements' in snapshot) setStockMovements(snapshot.stockMovements || [])
        if ('inventory' in snapshot) setInventory(snapshot.inventory || [])
        if ('storeCategories' in snapshot) setStoreCategories(snapshot.storeCategories || [])
        if ('categoryUnits' in snapshot) setCategoryUnits(snapshot.categoryUnits || {})
        if ('categoryThresholds' in snapshot) setCategoryThresholds(snapshot.categoryThresholds || {})
        if ('workspaceName' in snapshot) setWorkspaceName(canonicalBusiness?.business_name || ownerAccount?.business || snapshot.workspaceName || '')
        if ('currency' in snapshot) setCurrency(snapshot.currency || 'KES')
        if ('paymentMethods' in snapshot) setPaymentMethods(snapshot.paymentMethods || [])
        if (snapshot.strictSignIn !== undefined) setStrictSignIn(snapshot.strictSignIn)
        if (snapshot.allowMultipleDailyShifts !== undefined) setAllowMultipleDailyShifts(snapshot.allowMultipleDailyShifts)
        if (snapshot.biometricSignIn !== undefined) setBiometricSignIn(snapshot.biometricSignIn)
        if (snapshot.biometricSignOut !== undefined) setBiometricSignOut(snapshot.biometricSignOut)
        if (snapshot.biometricMark !== undefined) setBiometricMark(snapshot.biometricMark)
        if (snapshot.biometricPayroll !== undefined) setBiometricPayroll(snapshot.biometricPayroll)
        if (snapshot.defaultSignIn) setDefaultSignIn(snapshot.defaultSignIn)
        if (snapshot.defaultSignOut) setDefaultSignOut(snapshot.defaultSignOut)
        if (snapshot.lateSignIn) setLateSignIn(snapshot.lateSignIn)
        if (snapshot.earlySignOut) setEarlySignOut(snapshot.earlySignOut)
        if (snapshot.accessByMember) setAccessByMember(snapshot.accessByMember)
      }
      setRemoteWorkspaceLoaded(true)
    }
    void loadWorkspaceSnapshot().catch((error) => { if (!cancelled && hydrationId === workspaceHydrationId.current) { console.error('Workspace snapshot load failed', error); setRemoteWorkspaceLoaded(false) } })
    return () => { cancelled = true }
  }, [tenantId])
  useEffect(() => {
    if (!startupReady || loadedTenantId !== tenantId || !remoteWorkspaceLoaded || !supabaseReady || !isSupabaseConfigured || !supabase || tenantId === 'workspace') return
    const snapshot: WorkspaceSnapshot = { members: members.map(({ biometricCredentialId: _biometricCredentialId, ...member }) => member), departmentList, attendance, sales, salesHistory, deductions, expenses, stockMovements, inventory, storeCategories, categoryUnits, categoryThresholds, workspaceName, currency, paymentMethods, strictSignIn, allowMultipleDailyShifts, biometricSignIn, biometricSignOut, biometricMark, biometricPayroll, defaultSignIn, defaultSignOut, lateSignIn, earlySignOut, accessByMember }
    const version = workspaceSaveVersion.current + 1
    workspaceSaveVersion.current = version
    if (workspaceSaveTimer.current !== null) window.clearTimeout(workspaceSaveTimer.current)
    workspaceSaveTimer.current = window.setTimeout(() => {
      workspaceSaveQueue.current = workspaceSaveQueue.current.then(async () => {
        const { error } = await supabase.from('workspace_snapshots').upsert({ tenant_id: tenantId, payload: snapshot, updated_at: new Date().toISOString() }, { onConflict: 'tenant_id' })
        if (error) console.error('Workspace snapshot save failed', error)
      }).catch((error) => console.error('Workspace snapshot save failed', error))
    }, 250)
    return () => { if (workspaceSaveTimer.current !== null) { window.clearTimeout(workspaceSaveTimer.current); workspaceSaveTimer.current = null } }
  }, [members, departmentList, attendance, sales, salesHistory, deductions, expenses, stockMovements, inventory, storeCategories, categoryUnits, categoryThresholds, workspaceName, currency, paymentMethods, defaultSignIn, defaultSignOut, lateSignIn, earlySignOut, strictSignIn, allowMultipleDailyShifts, biometricSignIn, biometricSignOut, biometricMark, biometricPayroll, role, sessionMemberId, accessByMember, ownerAccount, tenantId, loadedTenantId, remoteWorkspaceLoaded, siteAdminAccount, siteAdminSession, businessAccounts, registrationRequests, activationCodes, packages, supabaseReady, startupReady])

  const todayAttendance = useMemo(() => members.map((member) => attendance.find((entry) => entry.memberId === member.id && entry.date === today) || { memberId: member.id, date: today, status: 'Absent' as AttendanceStatus, checkIn: '—', checkOut: '—' }), [members, attendance])
  const markChanged = () => undefined
  const saveWorkspaceSnapshotNow = async () => {
    if (!supabase || tenantId === 'workspace') {
      setAttendanceNotice('Changes saved successfully')
      setAttendanceNoticeTone('success')
      return
    }
    const snapshot: WorkspaceSnapshot = { members: members.map(({ biometricCredentialId: _biometricCredentialId, ...member }) => member), departmentList, attendance, sales, salesHistory, deductions, expenses, stockMovements, inventory, storeCategories, categoryUnits, categoryThresholds, workspaceName, currency, paymentMethods, strictSignIn, allowMultipleDailyShifts, biometricSignIn, biometricSignOut, biometricMark, biometricPayroll, defaultSignIn, defaultSignOut, lateSignIn, earlySignOut, accessByMember }
    const { error } = await supabase.from('workspace_snapshots').upsert({ tenant_id: tenantId, payload: snapshot, updated_at: new Date().toISOString() }, { onConflict: 'tenant_id' })
    setAttendanceNotice(error ? `Could not save changes: ${error.message}` : 'Changes saved successfully')
    setAttendanceNoticeTone(error ? 'error' : 'success')
  }
  const saveBusinessName = async () => {
    const nextName = workspaceName.trim()
    if (!nextName || !ownerAccount?.tenantId) return
    if (supabase) {
      const { error } = await supabase.from('business_accounts').update({ business_name: nextName }).eq('tenant_id', ownerAccount.tenantId)
      if (error) { setAttendanceNotice(`Could not save business name: ${error.message}`); return }
      await supabase.from('workspace_sessions').update({ workspace_name: nextName, updated_at: new Date().toISOString() }).eq('tenant_id', ownerAccount.tenantId)
    }
    setOwnerAccount((current) => current ? { ...current, business: nextName } : current)
    setAttendanceNotice('Business name saved successfully.')
  }
  const requireBiometric = async (memberId: number, enabled: boolean, action: string) => {
    if (!enabled) return true
    const member = members.find((item) => item.id === memberId)
    if (!member?.biometricCredentialId) { showAttendanceNotice(`${member?.name || 'This worker'} has no registered biometric. Ask the owner to register it.`); return false }
    try { await verifyBiometric(member.biometricCredentialId, tenantId, action, workspaceName); return true } catch (error) { showAttendanceNotice(error instanceof Error ? `${action} blocked: ${error.message}` : `${action} blocked by biometric verification.`); return false }
  }
  const recordBiometricProof = async (memberId: number, action: 'sign-in' | 'sign-out' | 'mark' | 'payroll') => {
    const member = members.find((item) => item.id === memberId)
    if (!member?.biometricCredentialId) return undefined
    const proof = { action, verifiedAt: new Date().toISOString(), credentialId: member.biometricCredentialId }
    await saveBiometricRecord('biometric_proofs', { tenant_id: tenantId, member_id: memberId, action, credential_id: proof.credentialId, verified_at: proof.verifiedAt, attendance_date: today })
    return proof
  }
  useEffect(() => {
    const handlePopState = () => setActiveNav(pageForPath(window.location.pathname))
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])
  useEffect(() => {
    if (ownerAccount && sessionMemberId !== 0) saveRefreshSession({ owner: ownerAccount, memberId: sessionMemberId, path: window.location.pathname })
    else if (siteAdminSession) saveRefreshSession({ siteAdmin: true, path: window.location.pathname })
  }, [activeNav, ownerAccount, sessionMemberId, siteAdminSession])
  const navigate = (page: string, memberId = sessionMemberId) => {
    const canonicalPage = page === 'Dashboard' ? 'Admin' : page === 'Add department' ? 'Departments' : page
    const routePaths = memberId > 0 ? grantPagePaths : pagePaths
    const path = routePaths[canonicalPage] || '/'
    window.history.pushState({}, '', path)
    setActiveNav(canonicalPage)
  }
  useEffect(() => {
    if (!window.location.pathname.startsWith('/admin/')) return
    const adminRoutes: Record<string, string> = { Overview: 'Admin', 'Business accounts': 'Business', Subscriptions: 'Packages', 'Platform settings': 'Admin settings', 'Sign out': 'Welcome' }
    const handleAdminNavigation = (event: MouseEvent) => {
      const button = (event.target as HTMLElement).closest('.app-shell > .sidebar button') as HTMLButtonElement | null
      const page = button?.textContent?.replace(/[↪⚙◈KES]/g, '').trim()
      if (!page || !adminRoutes[page]) return
      event.preventDefault()
      event.stopPropagation()
      if (page === 'Sign out') endSiteAdminSession()
      navigate(adminRoutes[page])
    }
    document.addEventListener('click', handleAdminNavigation, true)
    return () => document.removeEventListener('click', handleAdminNavigation, true)
  }, [activeNav])
  const currentMember = members[0]
  const toggleCurrentAttendance = () => {
    const existing = attendance.find((entry) => entry.memberId === currentMember?.id && entry.date === today)
    if (!currentMember) return
    if (existing?.status === 'Off') {
      showAttendanceNotice(`${currentMember.name} is marked off for today.`)
      return
    }
    if (isCheckedIn) {
    } else {
      const now = new Date()
      const checkIn = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      const status = timeToMinutes(now.toTimeString().slice(0, 5)) > timeToMinutes(defaultSignIn) ? 'Late' as AttendanceStatus : 'Present' as AttendanceStatus
      const entry = { memberId: currentMember.id, date: today, status, checkIn, checkOut: '—' }
      setAttendance((current) => existing ? current.map((item) => item.memberId === currentMember.id && item.date === today ? entry : item) : [...current, entry])
    }
    setIsCheckedIn(!isCheckedIn); markChanged()
  }
  const hasAttendanceForToday = (memberId: number) => attendance.some((entry) => entry.memberId === memberId && entry.date === today && (entry.checkIn !== '—' || entry.status === 'Present' || entry.status === 'Late' || entry.checkOut !== '—'))
  const markMemberAttendance = async (memberId: number, status: 'Present' | 'Absent', biometricEnabled = biometricMark, biometricAction = 'Mark attendance') => {
    const member = members.find((person) => person.id === memberId)
    const existing = attendance.find((entry) => entry.memberId === memberId && entry.date === today)
    if (existing?.status === 'Off') {
      showAttendanceNotice(`${member?.name || 'This worker'} is marked off for today.`)
      return false
    }
    const isAlreadySignedIn = Boolean(existing && (existing.status === 'Present' || existing.status === 'Late' || existing.checkOut !== '—'))
    if (status === 'Present') {
      if (isAlreadySignedIn) {
        showAttendanceNotice(`${member?.name || 'This worker'} has already signed in for today.`)
        return false
      }
      const existingStatus = existing?.status ?? 'Absent'
      if (hasAttendanceForToday(memberId) && (!existing || existingStatus === 'Absent' || existingStatus === 'Off')) {
        showAttendanceNotice(`${member?.name || 'This worker'} has already signed in for today.`)
        return false
      }
    }
    if (status === 'Absent') {
      if (existing && (existing.status === 'Present' || existing.status === 'Late' || existing.checkOut !== '—')) {
        showAttendanceNotice(`${member?.name || 'This worker'} has already signed in for today.`)
        return false
      }
    }
    let biometricProof
    if (status === 'Present' && biometricEnabled) {
      if (!(await requireBiometric(memberId, true, biometricAction))) return false
      biometricProof = await recordBiometricProof(memberId, 'mark')
    }
    const nextEntry = {
      memberId,
      date: today,
      status: status === 'Present' ? (timeToMinutes(new Date().toTimeString().slice(0, 5)) > timeToMinutes(defaultSignIn) ? 'Late' as AttendanceStatus : 'Present' as AttendanceStatus) : 'Absent' as AttendanceStatus,
      checkIn: status === 'Present' ? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—',
      checkOut: '—',
      biometricProof,
    }
    setAttendance((current) => existing ? current.map((entry) => entry.memberId === memberId && entry.date === today ? nextEntry : entry) : [...current, nextEntry])
    markChanged()
    return status === 'Present'
  }
  const markMemberSignOut = async (memberId: number) => {
    const member = members.find((person) => person.id === memberId)
    const entry = attendance.find((item) => item.memberId === memberId && item.date === today)
    if (!entry || entry.status === 'Off' || entry.status === 'Absent' || entry.checkIn === '—') {
      showAttendanceNotice(`${member?.name || 'This worker'} has already signed out for today.`)
      return false
    }
    if (entry.checkOut !== '—') {
      showAttendanceNotice(`${member?.name || 'This worker'} has already signed out for today.`)
      return false
    }
    let biometricProof
    if (biometricSignOut) {
      if (!(await requireBiometric(memberId, true, 'Sign out'))) return false
      biometricProof = await recordBiometricProof(memberId, 'sign-out')
    }
    const checkOut = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const checkoutStatus = timeToMinutes(new Date().toTimeString().slice(0, 5)) < timeToMinutes(defaultSignOut) ? 'Early' as AttendanceStatus : entry.status
    setAttendance((current) => current.map((item) => item.memberId === memberId && item.date === today ? { ...item, status: checkoutStatus, checkOut, biometricProof: biometricProof || item.biometricProof } : item))
    markChanged()
    if (!(window as any).__bulkAttendanceInProgress) showAttendanceNotice(`${member?.name || 'This worker'} signed out successfully`)
    return true
  }
  const createBusinessAccount = async (account: { businessName: string; ownerName: string; email: string; username: string; password: string; industry: string; plan: SubscriptionPlan; status?: SubscriptionStatus }) => {
    const selectedPackage = packages.find((item) => item.name === account.plan) || defaultPackages.find((item) => item.name === account.plan)!
    const databasePlan = ['Starter', 'Growth', 'Scale'].includes(account.plan) ? account.plan : 'Starter'
    const durationDays = selectedPackage.durationUnit === 'year' ? selectedPackage.duration * 365 : selectedPackage.durationUnit === 'month' ? selectedPackage.duration * 30 : selectedPackage.durationUnit === 'week' ? selectedPackage.duration * 7 : selectedPackage.duration
    const passwordHash = await hashPassword(account.password)
    const nextAccount: BusinessAccount = {
      id: Date.now(),
      businessName: account.businessName.trim(),
      ownerName: account.ownerName.trim(),
      email: account.email.trim(),
      username: account.username.trim().toLowerCase(),
      password: passwordHash,
      industry: account.industry,
      plan: databasePlan,
      status: account.status || 'Trial',
      seats: selectedPackage.seats,
      monthlyPrice: selectedPackage.price,
      nextBilling: new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      createdAt: today,
      tenantId: `tenant-${Date.now()}`,
    }
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('business_accounts').upsert({ id: nextAccount.id, business_name: nextAccount.businessName, owner_name: nextAccount.ownerName, email: nextAccount.email, username: nextAccount.username, password: nextAccount.password, industry: nextAccount.industry, plan: nextAccount.plan, status: nextAccount.status, seats: nextAccount.seats, monthly_price: nextAccount.monthlyPrice, next_billing: nextAccount.nextBilling, created_at: nextAccount.createdAt, tenant_id: nextAccount.tenantId })
      if (error) throw new Error(error.message || error.details || error.hint || 'Database rejected the business account')
    }
    setMembers([]); setDepartmentList([]); setAttendance([]); setSales([]); setSalesHistory([]); setDeductions([]); setInventory([]); setStoreCategories([]); setAccessByMember(emptyAccess); setSessionMemberId(0); setRole('Owner')
    setBusinessAccounts((current) => [nextAccount, ...current])
    const workspaceOwner = { name: account.ownerName.trim(), username: nextAccount.username, password: passwordHash, business: account.businessName.trim(), tenantId: nextAccount.tenantId }
    setOwnerAccount(workspaceOwner)
    void persistSharedWorkspaceSession({ username: workspaceOwner.username, password: workspaceOwner.password, tenantId: workspaceOwner.tenantId || '', businessName: workspaceOwner.business || account.businessName.trim(), ownerName: workspaceOwner.name })
    setWorkspaceName(account.businessName.trim())
    setActiveNav('Overview')
    return nextAccount
  }
  const updateSubscription = (accountId: number, updates: Partial<Pick<BusinessAccount, 'status' | 'plan' | 'seats' | 'nextBilling'>>) => {
    const targetAccount = businessAccounts.find((account) => account.id === accountId)
    setBusinessAccounts((current) => {
      const next = current.map((account) => account.id === accountId ? { ...account, ...updates, monthlyPrice: updates.plan ? packages.find((item) => item.name === updates.plan)?.price || account.monthlyPrice : account.monthlyPrice } : account)
      const updated = next.find((account) => account.id === accountId)
      if (updated && isSupabaseConfigured && supabase) void (async () => {
        const values = { plan: updated.plan, status: updated.status, seats: updated.seats, monthly_price: updated.monthlyPrice, next_billing: updated.nextBilling }
        let result = await supabase.from('business_accounts').update(values).eq('id', accountId).select('id')
        if (!result.data?.length && targetAccount?.tenantId) result = await supabase.from('business_accounts').update(values).eq('tenant_id', targetAccount.tenantId).select('id')
        if (result.error || !result.data?.length) window.alert(`Business status could not be saved: ${result.error?.message || 'No matching business account was found.'}`)
      })()
      return next
    })
  }
  const deleteBusinessAccount = async (accountId: number) => {
    const account = businessAccounts.find((item) => item.id === accountId)
    if (!account) return
    setBusinessAccounts((current) => current.filter((item) => item.id !== accountId))
    if (isSupabaseConfigured && supabase) {
      await supabase.from('business_accounts').delete().eq('id', accountId)
      await supabase.from('workspace_snapshots').delete().eq('tenant_id', account.tenantId)
      await supabase.from('workspace_sessions').delete().eq('tenant_id', account.tenantId)
    }
    setDeleteTargetId(null)
    navigate('Business')
  }
  const createActivationCode = (packageName: SubscriptionPlan) => {
    const code = `BT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
    setActivationCodes((current) => [{ id: Date.now(), code, packageName, status: 'Available', createdAt: today }, ...current])
    return code
  }
  const consumeActivationCode = (code: string, packageName: SubscriptionPlan, businessName: string) => {
    const match = activationCodes.find((item) => item.code.toUpperCase() === code.trim().toUpperCase() && item.status === 'Available' && item.packageName === packageName)
    if (!match) return false
    setActivationCodes((current) => current.map((item) => item.id === match.id ? { ...item, status: 'Used', usedBy: businessName } : item))
    return true
  }
  const updatePackage = (name: SubscriptionPlan, updates: Partial<PackageConfig>) => setPackages((current) => current.map((item) => item.name === name ? { ...item, ...updates } : item))
  const savePackages = async () => {
    if (!supabase) { window.alert('Supabase is not configured. Package changes cannot be saved.'); return }
    const payload = { registrationRequests, activationCodes, packages }
    const updatedAt = new Date().toISOString()
    const { data: existing, error: readError } = await supabase.from('site_admin_snapshots').select('id').eq('id', 1).maybeSingle()
    if (readError) { window.alert(`Package changes could not be saved: ${readError.message}`); return }
    const result = existing
      ? await supabase.from('site_admin_snapshots').update({ payload, updated_at: updatedAt }).eq('id', 1)
      : await supabase.from('site_admin_snapshots').insert({ id: 1, payload, updated_at: updatedAt })
    if (result.error) { window.alert(`Package changes could not be saved: ${result.error.message}`); return }
    setAttendanceNotice('Package changes saved successfully')
  }
  const saveReviewDecision = async (key: string, decision: 'Activated' | 'Declined') => {
    const nextDecisions = { ...reviewDecisions, [key]: decision }
    setReviewDecisions(nextDecisions)
    localStorage.setItem('biztrack-review-decisions', JSON.stringify(nextDecisions))
    if (!supabase) return
    const { data } = await supabase.from('site_admin_snapshots').select('payload').eq('id', 1).maybeSingle()
    const payload = { ...(data?.payload || {}), reviewDecisions: nextDecisions }
    await supabase.from('site_admin_snapshots').upsert({ id: 1, payload, updated_at: new Date().toISOString() }, { onConflict: 'id' })
  }
  const activateRegistration = (request: RegistrationRequest, packageName: SubscriptionPlan, activationCode: string) => {
    if (!request.applicantName || !request.businessName || !request.email || !request.username || !request.password || !request.industry) return false
    if (!consumeActivationCode(activationCode, packageName, request.businessName)) return false
    createBusinessAccount({ businessName: request.businessName, ownerName: request.applicantName, email: request.email, username: request.username, password: request.password, industry: request.industry, plan: packageName })
    setRegistrationRequests((current) => current.filter((item) => item.id !== request.id))
    return true
  }
  const activateClientRegistration = async (request: RegistrationRequest) => {
    if (!request.username || !request.password || !request.businessName || !request.applicantName) return
    await createBusinessAccount({ businessName: request.businessName, ownerName: request.applicantName, email: request.email || `${request.username}@biztrack.app`, username: request.username, password: request.password, industry: request.industry || 'General', plan: request.plan || packages[0]?.name || 'Starter', status: 'Active' })
    setRegistrationRequests((current) => current.map((item) => item.id === request.id ? { ...item, reviewStatus: 'Activated' } : item))
    await saveReviewDecision(`request:${request.id}`, 'Activated')
    setOwnerAccount(null)
    setSessionMemberId(0)
    setActiveNav('Activate business')
  }
  const declineClientRegistration = (requestId: number) => { setRegistrationRequests((current) => current.map((item) => item.id === requestId ? { ...item, reviewStatus: 'Declined' } : item)); void saveReviewDecision(`request:${requestId}`, 'Declined') }
  const showAttendanceNotice = (message: string, tone?: 'success' | 'error') => {
    setAttendanceNotice(message)
    setAttendanceNoticeTone(tone || (/blocked|no registered|already|marked off|could not|failed|error|cancelled|not configured/i.test(message) ? 'error' : 'success'))
    navigate('Attendance')
  }
  useEffect(() => { (window as any).__attendanceSuccess = (message: string) => showAttendanceNotice(message, 'success'); return () => { delete (window as any).__attendanceSuccess } }, [attendanceNotice])
  const updatePayrollStatus = (memberIds: number[], startDate: string, endDate: string, paymentStatus: PaymentStatus) => {
    setAttendance((current) => current.map((entry) => {
      const inScope = memberIds.includes(entry.memberId) && entry.checkOut !== '—' && entry.date >= startDate && entry.date <= endDate
      const currentStatus = entry.paymentStatus ?? 'Pending'
      if (!inScope || !canTransitionPaymentStatus(currentStatus, paymentStatus)) return entry
      return { ...entry, paymentStatus }
    }))
    markChanged()
  }
  useEffect(() => { (window as any).__biztrackUpdatePayrollStatus = updatePayrollStatus; (window as any).__biztrackDeductions = deductions }, [attendance, deductions])
  const login = async (memberId: number) => {
    setSessionMemberId(memberId)
    if (ownerAccount) saveRefreshSession({ owner: ownerAccount, memberId, path: window.location.pathname })
    const firstAssignedPage = memberId > 0 ? uniqueAccessAreas.find((page) => (accessByMember[memberId] || []).includes(page)) : 'Overview'
    navigate(firstAssignedPage || 'Overview', memberId)
  }
  const gatedMarkMemberAttendance = async (memberId: number, status: 'Present' | 'Absent') => {
    return markMemberAttendance(memberId, status, biometricSignIn, 'Sign in')
  }
  const gatedMarkMemberSignOut = async (memberId: number) => {
    return markMemberSignOut(memberId)
  }
  const verifyPayrollPayment = async (memberId: number) => {
    if (!(await requireBiometric(memberId, biometricPayroll, 'mark payment as paid'))) return false
    if (biometricPayroll) await recordBiometricProof(memberId, 'payroll')
    return true
  }
  ;(window as any).__biztrackVerifyPayrollPayment = verifyPayrollPayment
  const loginBusinessAccount = async (account: BusinessAccount, memberId = -1, access?: AccessArea[]) => {
    const workspaceOwner = { name: account.ownerName, username: account.username, password: account.password, business: account.businessName, tenantId: account.tenantId, industry: account.industry, plan: account.plan }
    let remoteSnapshot: Partial<WorkspaceSnapshot> | undefined
    if (isSupabaseConfigured && supabase && workspaceOwner.tenantId) {
      const { data } = await supabase.from('workspace_snapshots').select('payload').eq('tenant_id', workspaceOwner.tenantId).maybeSingle()
      remoteSnapshot = data?.payload as Partial<WorkspaceSnapshot> | undefined
    }
    setOwnerAccount(workspaceOwner)
    void persistSharedWorkspaceSession({ username: workspaceOwner.username, password: workspaceOwner.password, tenantId: workspaceOwner.tenantId || '', businessName: workspaceOwner.business || account.businessName, ownerName: workspaceOwner.name })
    if (access) setAccessByMember((current) => ({ ...current, [memberId]: access }))
    if (remoteSnapshot) {
      if ('members' in remoteSnapshot) setMembers((remoteSnapshot.members || []).map((member, index) => normalizeMember(member, index, workspaceOwner.tenantId)))
      if ('departmentList' in remoteSnapshot) setDepartmentList(remoteSnapshot.departmentList || [])
      if ('attendance' in remoteSnapshot) setAttendance(remoteSnapshot.attendance || [])
      if ('sales' in remoteSnapshot) setSales(remoteSnapshot.sales || [])
      if ('salesHistory' in remoteSnapshot) setSalesHistory(remoteSnapshot.salesHistory || [])
      if ('deductions' in remoteSnapshot) setDeductions(remoteSnapshot.deductions || [])
      if ('expenses' in remoteSnapshot) setExpenses(remoteSnapshot.expenses || [])
      if ('stockMovements' in remoteSnapshot) setStockMovements(remoteSnapshot.stockMovements || [])
      if ('inventory' in remoteSnapshot) setInventory(remoteSnapshot.inventory || [])
      if ('storeCategories' in remoteSnapshot) setStoreCategories(remoteSnapshot.storeCategories || [])
      if ('categoryUnits' in remoteSnapshot) setCategoryUnits(remoteSnapshot.categoryUnits || {})
      if ('categoryThresholds' in remoteSnapshot) setCategoryThresholds(remoteSnapshot.categoryThresholds || {})
      setWorkspaceName(workspaceOwner.business || account.businessName)
      if ('currency' in remoteSnapshot) setCurrency(remoteSnapshot.currency || 'KES')
      if ('paymentMethods' in remoteSnapshot) setPaymentMethods(remoteSnapshot.paymentMethods || [])
      if (remoteSnapshot.strictSignIn !== undefined) setStrictSignIn(remoteSnapshot.strictSignIn)
      if (remoteSnapshot.allowMultipleDailyShifts !== undefined) setAllowMultipleDailyShifts(remoteSnapshot.allowMultipleDailyShifts)
      if (remoteSnapshot.biometricSignIn !== undefined) setBiometricSignIn(remoteSnapshot.biometricSignIn)
      if (remoteSnapshot.biometricSignOut !== undefined) setBiometricSignOut(remoteSnapshot.biometricSignOut)
      if (remoteSnapshot.biometricMark !== undefined) setBiometricMark(remoteSnapshot.biometricMark)
      if (remoteSnapshot.biometricPayroll !== undefined) setBiometricPayroll(remoteSnapshot.biometricPayroll)
      if (remoteSnapshot.defaultSignIn) setDefaultSignIn(remoteSnapshot.defaultSignIn)
      if (remoteSnapshot.defaultSignOut) setDefaultSignOut(remoteSnapshot.defaultSignOut)
      if (remoteSnapshot.lateSignIn) setLateSignIn(remoteSnapshot.lateSignIn)
      if (remoteSnapshot.earlySignOut) setEarlySignOut(remoteSnapshot.earlySignOut)
      if (remoteSnapshot.accessByMember) setAccessByMember(remoteSnapshot.accessByMember)
    }
    setSessionMemberId(memberId)
    saveRefreshSession({ owner: workspaceOwner, memberId, path: window.location.pathname })
    const firstAssignedPage = memberId > 0 ? (access || []).find((page) => uniqueAccessAreas.includes(page)) : 'Overview'
    setRemoteWorkspaceLoaded(true)
    navigate(firstAssignedPage || 'Overview', memberId)
  }
  const logout = () => {
    setSessionMemberId(0)
    setOwnerAccount(null)
    saveRefreshSession(null)
    window.history.replaceState({}, '', pagePaths['Sign in'])
    setActiveNav('Sign in')
  }
  const startSiteAdminSession = () => { setSiteAdminSession(true); saveRefreshSession({ siteAdmin: true, path: window.location.pathname }) }
  const endSiteAdminSession = () => { setSiteAdminSession(false); saveRefreshSession(null) }
  const canAccess = (page: string) => sessionMemberId === -1 || accessByMember[sessionMemberId]?.includes(page as AccessArea) || page === 'Login'
  ;(window as any).__biztrackVisibleWorkspacePages = sessionMemberId === -1 ? sidebarGroups.flatMap((group) => group.links) : accessByMember[sessionMemberId] || []
  const dashboardName = siteAdminSession ? 'Site admin' : sessionMemberId === -1 ? ownerAccount?.name || 'Owner' : members.find((member) => member.id === sessionMemberId)?.name || 'Member'
  const dashboardDepartment = siteAdminSession ? 'Platform workspace' : sessionMemberId === -1 ? 'Owner' : members.find((member) => member.id === sessionMemberId)?.department || 'Unassigned'
  const businessName = workspaceName || ownerAccount?.business || 'Your workspace'
  ;(window as any).__biztrackHelpOwner = ownerAccount
  ;(window as any).__biztrackHelpMembers = members
  ;(window as any).__biztrackHelpSessionMemberId = sessionMemberId
  const currentBusinessAccount = ownerAccount ? businessAccounts.find((account) => account.username.toLowerCase() === ownerAccount.username.toLowerCase() || (ownerAccount.tenantId && account.tenantId === ownerAccount.tenantId)) : undefined
  ;(window as any).__biztrackDeductions = deductions
  ;(window as any).__biztrackWhatsappNumber = platformSettings.whatsappNumber || readStoredWhatsappNumber()
  useEffect(() => {
    if (sessionMemberId <= 0 || !window.location.pathname.startsWith('/master/')) return
    const grantPath = grantPagePaths[activeNav]
    if (grantPath) window.history.replaceState({}, '', grantPath)
  }, [activeNav, sessionMemberId])
  useEffect(() => {
    const isPublicPage = activeNav === 'Welcome' || activeNav === 'Sign in' || activeNav === 'Register'
    const isSiteAdminPage = ['Admin', 'Business', 'Users', 'Register a new business', 'Activation codes', 'Packages', 'Activate business', 'Admin settings', 'Delete'].includes(activeNav) || window.location.pathname.startsWith('/admin')
    document.title = siteAdminSession || isSiteAdminPage || isPublicPage ? 'BizTrack' : businessName !== 'Your workspace' ? businessName : 'BizTrack'
  }, [activeNav, businessName, sessionMemberId, siteAdminSession])
  useEffect(() => {
    document.querySelectorAll('.app-shell .workspace-switcher strong').forEach((element) => { const [first, second] = businessNameParts(businessName); element.replaceChildren(Object.assign(document.createElement('span'), { textContent: first }), Object.assign(document.createElement('span'), { textContent: second })) })
    const workspaceDot = document.querySelector('.app-shell .workspace-dot')
    if (workspaceDot) workspaceDot.textContent = businessName.charAt(0).toUpperCase()
    document.querySelectorAll('.app-shell .sidebar-footer').forEach((footer) => { const label = Array.from(footer.children).find((child) => child.textContent?.trim() === 'Help center') as HTMLElement | undefined; if (!label || label.closest('.help-link')) return; const link = document.createElement('a'); link.className = 'help-link'; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.href = whatsappHelpUrl(businessName, ownerAccount, members, sessionMemberId, platformSettings.whatsappNumber); if (!link.href) { link.removeAttribute('target'); link.addEventListener('click', (event) => { event.preventDefault(); window.alert('Help center WhatsApp number is not configured.') }) } label.replaceWith(link); link.append(document.querySelector('.help-mark')?.cloneNode(true) || '?', document.createTextNode('Help center')) })
  }, [businessName, activeNav, ownerAccount, members, sessionMemberId, platformSettings.whatsappNumber])
  useEffect(() => {
    document.querySelectorAll('.app-shell .topbar').forEach((topbar) => {
      const breadcrumb = topbar.querySelector('.breadcrumbs strong')
      if (breadcrumb) breadcrumb.textContent = visiblePageName(activeNav)

      topbar.querySelectorAll('.profile-menu, .workspace-switcher').forEach((element) => element.remove())
      const workspace = document.createElement('div')
      workspace.className = 'workspace-switcher topbar-workspace'
      workspace.innerHTML = `<span class="workspace-dot">${dashboardName.charAt(0).toUpperCase()}</span><span><strong>${dashboardName}</strong><small>${dashboardDepartment}</small></span>`
      topbar.appendChild(workspace)

      let actions = topbar.querySelector('.top-actions')
      if (!actions) {
        actions = document.createElement('div')
        actions.className = 'top-actions'
        topbar.appendChild(actions)
      }
      actions.querySelectorAll('.profile-menu, .workspace-switcher').forEach((element) => element.remove())
    })
  }, [activeNav, businessName, dashboardName, dashboardDepartment])
  useEffect(() => {
    if (activeNav !== 'Overview') return
    const updateDashboardHeading = () => {
      const heading = document.querySelector('.page-heading h1')
      const eyebrow = document.querySelector('.page-heading .eyebrow')
      const now = new Date()
      if (heading) heading.textContent = `Good morning, ${dashboardName}`
      if (eyebrow) eyebrow.textContent = `${formatDate(now.toISOString())} · ${now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`
    }
    updateDashboardHeading()
    const timer = window.setInterval(updateDashboardHeading, 60000)
    return () => window.clearInterval(timer)
  }, [activeNav, dashboardName])
  useEffect(() => {
    if (activeNav !== 'Sales') return
    const table = document.querySelector('.sales-layout .team-panel .table-wrap')
    const rows = Array.from(table?.querySelectorAll('tbody tr') || []) as HTMLTableRowElement[]
    if (!table || table.querySelector('.sales-table-filters')) return
    const filters = document.createElement('div')
    filters.className = 'sales-table-filters'
    const method = document.createElement('select')
    method.className = 'filter-button'
    method.setAttribute('aria-label', 'Filter payment method')
    ;['All methods', 'Cash', 'Credit', 'Mobile money'].forEach((value) => method.add(new Option(value, value)))
    const date = document.createElement('input')
    date.className = 'filter-button'
    date.type = 'date'
    date.setAttribute('aria-label', 'Filter sales date')
    const cashier = document.createElement('input')
    cashier.className = 'filter-button'
    cashier.type = 'search'
    cashier.placeholder = 'Search cashier'
    cashier.setAttribute('aria-label', 'Search cashier')
    filters.append(method, date, cashier)
    table.prepend(filters)
    const applyFilter = () => {
      const search = cashier.value.trim().toLowerCase()
      rows.forEach((row) => {
        const cells = Array.from(row.cells).map((cell) => cell.textContent?.trim() || '')
        const matchesMethod = method.value === 'All methods' || cells[1] === method.value
        const matchesDate = !date.value || cells[2] === date.value
        const matchesCashier = !search || cells[4].toLowerCase().includes(search)
        row.hidden = !(matchesMethod && matchesDate && matchesCashier)
      })
    }
    method.addEventListener('change', applyFilter)
    date.addEventListener('change', applyFilter)
    cashier.addEventListener('input', applyFilter)
    return () => { method.removeEventListener('change', applyFilter); date.removeEventListener('change', applyFilter); cashier.removeEventListener('input', applyFilter); filters.remove() }
  }, [activeNav, sales, salesHistory])
  useEffect(() => {
    if (activeNav !== 'Attendance') return
    const heading = document.querySelector('.attendance-review .panel-heading')
    const table = document.querySelector('.attendance-review table')
    if (!heading || !table || heading.querySelector('.attendance-filters')) return
    const action = heading.querySelector('.filter-button')
    const filters = document.createElement('div')
    filters.className = 'attendance-filters'
    const date = document.createElement('input')
    date.type = 'date'
    date.value = today
    date.max = today
    date.setAttribute('aria-label', 'Attendance date')
    const department = document.createElement('select')
    department.setAttribute('aria-label', 'Attendance department')
    const departments = ['All departments', ...Array.from(new Set(members.map((member) => member.department)))]
    departments.forEach((item) => department.add(new Option(item, item)))
    filters.append(date, department)
    action?.replaceWith(filters)
    const rows = Array.from(table.querySelectorAll('tbody tr'))
    const applyFilter = () => {
      rows.forEach((row) => {
        const departmentCell = row.children[1]?.textContent?.trim() || ''
        row.toggleAttribute('hidden', department.value !== 'All departments' && departmentCell !== department.value)
      })
    }
    date.addEventListener('change', () => { if (date.value > today) date.value = today; applyFilter() })
    department.addEventListener('change', applyFilter)
    return () => { department.removeEventListener('change', applyFilter); filters.remove() }
  }, [activeNav, members])
  useEffect(() => {
    if (activeNav !== 'Team' || !selectingExistingAccount) return
    const panel = document.querySelector('.team-panel')
    const table = panel?.querySelector('table')
    const addButton = panel?.querySelector('.team-panel-footer button') as HTMLButtonElement | null
    if (!panel || !table || !addButton) return
    addButton.disabled = true
    addButton.textContent = 'Add member disabled'
    const header = table.querySelector('thead tr')
    const rows = Array.from(table.querySelectorAll('tbody tr'))
    const selectHeader = document.createElement('th')
    selectHeader.textContent = 'SELECT'
    header?.prepend(selectHeader)
    let selectedId: number | null = null
    rows.forEach((row) => {
      const memberId = Number(row.querySelector('td strong')?.textContent?.replace('#', ''))
      const cell = document.createElement('td')
      const input = document.createElement('input')
      input.type = 'radio'; input.name = 'permission-member'; input.setAttribute('aria-label', 'Select team member')
      input.addEventListener('change', () => { selectedId = memberId; proceed.disabled = false })
      cell.appendChild(input); row.prepend(cell)
    })
    const proceed = document.createElement('button')
    proceed.className = 'primary-button'; proceed.textContent = 'Proceed'; proceed.disabled = true
    proceed.addEventListener('click', () => {
      if (!selectedId) return
      setPermissionTargetId(selectedId)
      setSelectingExistingAccount(false)
      navigate('Permissions')
    })
    panel.querySelector('.team-panel-footer')?.appendChild(proceed)
    return () => { selectHeader.remove(); rows.forEach((row) => row.firstElementChild?.remove()); proceed.remove() }
  }, [activeNav, selectingExistingAccount])
  useEffect(() => {
    if (activeNav !== 'Permissions') return
    const headingAction = document.querySelector('.permissions-layout')?.previousElementSibling?.querySelector('.heading-actions') as HTMLElement | null
    const people = document.querySelector('.permissions-people')
    if (!people || people.querySelector('.permissions-add-account-dom')) return
    if (headingAction) headingAction.style.display = 'none'
    const button = document.createElement('button')
    button.className = 'primary-button permissions-add-account-dom'
    button.textContent = '+ Add account'
    button.addEventListener('click', () => setAccountChoiceOpen(true))
    people.appendChild(button)
    return () => button.remove()
  }, [activeNav])
  useEffect(() => {
    if (activeNav !== 'Settings') return
    const panel = document.querySelector('.settings-stack > .panel')
    if (!panel || panel.querySelector('.business-name-save')) return
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'primary-button business-name-save'
    button.textContent = 'Save changes'
    button.addEventListener('click', () => { void saveBusinessName() })
    panel.appendChild(button)
    return () => button.remove()
  }, [activeNav, workspaceName, ownerAccount?.tenantId])
  useEffect(() => {
    if (activeNav !== 'Settings') return
    const settings = document.querySelector('.settings-stack')
    if (!settings || settings.querySelector('.biometric-policy-panel')) return
    const panel = document.createElement('article')
    panel.className = 'panel member-form biometric-policy-panel'
    panel.innerHTML = `<div class="panel-heading"><div><h2>Biometric verification</h2><p>Choose which worker actions require the worker's registered device biometric.</p></div></div><div class="settings-choice-grid"><label class="settings-choice biometric-choice"><input type="checkbox" data-biometric="sign-in"><span>Worker sign-in</span></label><label class="settings-choice biometric-choice"><input type="checkbox" data-biometric="sign-out"><span>Worker sign-out</span></label><label class="settings-choice biometric-choice"><input type="checkbox" data-biometric="mark"><span>Mark selected workers</span></label><label class="settings-choice biometric-choice"><input type="checkbox" data-biometric="payroll"><span>Payroll payment</span></label></div><p class="subheading">Biometrics use your browser's secure WebAuthn prompt. Raw fingerprint data never enters Biz Track.</p>`
    settings.appendChild(panel)
    const saveButton = document.createElement('button')
    saveButton.type = 'button'
    saveButton.className = 'primary-button biometric-settings-save'
    saveButton.textContent = 'Save changes'
    saveButton.addEventListener('click', () => { void saveWorkspaceSnapshotNow() })
    panel.appendChild(saveButton)
    const controls = panel.querySelectorAll<HTMLInputElement>('input[data-biometric]')
    controls.forEach((control) => {
      const key = control.dataset.biometric
      control.checked = key === 'sign-in' ? biometricSignIn : key === 'sign-out' ? biometricSignOut : key === 'mark' ? biometricMark : biometricPayroll
      control.addEventListener('change', () => { if (key === 'sign-in') setBiometricSignIn(control.checked); if (key === 'sign-out') setBiometricSignOut(control.checked); if (key === 'mark') setBiometricMark(control.checked); if (key === 'payroll') setBiometricPayroll(control.checked); markChanged() })
    })
    return () => panel.remove()
  }, [activeNav, biometricSignIn, biometricSignOut, biometricMark, biometricPayroll, workspaceName, tenantId])
  /*
    <main className="main-content"><header className="topbar"><div className="breadcrumbs"><span>Workspace</span><b>/</b><strong>{activeNav}</strong></div><div className="top-actions"><div className={`sync-status ${isOnline ? 'online' : 'offline'}`}><span className="status-dot"></span>{syncLabel}</div><button className="icon-button" aria-label="Notifications">♧<span className="notification-dot"></span></button><div className="profile-menu"><div className="avatar avatar-olive">KA</div><span><strong>{sessionMemberId === 0 ? 'Kemi A.' : members.find((member) => member.id === sessionMemberId)?.name || 'Worker'}</strong><small>{sessionMemberId === 0 ? role : 'Worker'}</small></span><button className="text-button" onClick={logout}>Log out</button></div></div></header><div className="page-content">{activeNav === 'Login' ? <LoginPage members={members} onLogin={login} /> : !canAccess(activeNav) ? <AccessDeniedPage onBack={() => navigate('Overview')} /> : activeNav === 'Attendance' ? <AttendancePage members={members} entries={todayAttendance} /> : activeNav === 'Departments' ? <DepartmentsPage departments={departmentList} members={members} onAdd={() => navigate('Add department')} onDelete={deleteDepartment} /> : activeNav === 'Add department' ? <AddDepartmentPage onSubmit={addDepartment} onCancel={() => navigate('Departments')} /> : activeNav === 'Add member' ? <AddMemberPage departments={departmentList} defaultSignIn={defaultSignIn} defaultSignOut={defaultSignOut} onSubmit={addMember} onCancel={() => navigate('Team')} /> : activeNav === 'Team' ? <TeamPage members={members} onAdd={() => navigate('Add member')} onDelete={deleteMember} /> : activeNav === 'Payroll' ? <PayrollPage members={members} attendance={attendance} /> : activeNav === 'Sales' ? <SalesPage sales={sales} salesHistory={salesHistory} onAdd={addSale} onReset={resetSales} /> : activeNav === 'Inventory' ? <InventoryPage inventory={inventory} categories={storeCategories} onAdd={addInventoryItem} onAdjust={updateInventoryQuantity} /> : activeNav === 'Settings' ? <SettingsPage members={members} defaultSignIn={defaultSignIn} defaultSignOut={defaultSignOut} strictSignIn={strictSignIn} setStrictSignIn={setStrictSignIn} categories={storeCategories} setCategories={setStoreCategories} setDefaultSignIn={setDefaultSignIn} setDefaultSignOut={setDefaultSignOut} setMembers={setMembers} onChange={markChanged} /> : activeNav === 'Worker sign-in' ? <WorkerSignInPage members={members} entries={attendance} strictSignIn={strictSignIn} defaultSignIn={defaultSignIn} onAttendance={toggleCurrentAttendance} onMarkAttendance={markMemberAttendance} onMarkSignOut={markMemberSignOut} /> : <OverviewPage role={role} setRole={setRole} members={members} isCheckedIn={isCheckedIn} setIsCheckedIn={toggleCurrentAttendance} isOnline={isOnline} onAttendance={() => navigate('Attendance')} />}</div></main>
  */
  const addMember = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const name = String(form.get('fullName') || '').trim(); const phone = String(form.get('phone') || '').trim(); const email = String(form.get('email') || '').trim() || 'NA'; const department = String(form.get('department') || departmentList[0])
    if (!name || !phone || !department) return
    const payRate = Number(form.get('payRate') || 0)
    const payFrequency = String(form.get('payFrequency') || 'Daily') as PayFrequency
    const signInTime = String(form.get('signInTime') || defaultSignIn)
    const signOutTime = String(form.get('signOutTime') || defaultSignOut)
    const hasAccount = form.get('hasAccount') === 'on'
    const username = String(form.get('username') || '').trim()
    const password = String(form.get('password') || '')
    if (hasAccount && (!username || password.length < 6)) return
    const id = Date.now()
    const passwordHash = await hashPassword(password)
    let biometricCredentialId = ''
    const biometricRequired = biometricSignIn || biometricSignOut || biometricMark || biometricPayroll
    if (biometricRequired) {
      try {
        biometricCredentialId = await registerBiometric(id, name, workspaceName || ownerAccount?.business || 'your business', tenantId, ownerAccount ? { username: ownerAccount.username, password: ownerAccount.password } : undefined)
        await saveBiometricRecord('biometric_credentials', { tenant_id: tenantId, member_id: id, member_name: name, credential_id: biometricCredentialId, registered_at: new Date().toISOString() }, ownerAccount ? { username: ownerAccount.username, password: ownerAccount.password } : undefined)
      } catch (error) { setAttendanceNotice(error instanceof Error ? error.message : 'Biometric registration failed.'); return }
    }
    setMembers((current) => [...current, { id, tenantId, name, username, password: passwordHash, hasAccount, biometricCredentialId, phone, email, department, role: 'Worker', initials: initialsFor(name), color: 'mint', payRate, payFrequency, signInTime, signOutTime }])
    markChanged(); event.currentTarget.reset(); navigate('Team')
  }
  const addDepartment = (name: string) => {
    const nextName = name.trim()
    if (!nextName || departmentList.some((department) => department.toLowerCase() === nextName.toLowerCase())) return
    setDepartmentList((current) => [...current, nextName]); markChanged()
  }
  ;(window as any).__biztrackAddDepartment = addDepartment
  const deleteDepartment = async (name: string) => {
    if (!await showBusinessConfirm(workspaceName || ownerAccount?.business || 'Your business', `Delete the ${name} department?`)) return
    setDepartmentList((current) => current.filter((department) => department !== name)); markChanged()
  }
  const addSale = (sale: Sale) => { const now = new Date(); setSales((current) => [...current, { ...sale, cashier: dashboardName, date: now.toISOString().slice(0, 10), time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }]); markChanged() }
  const addDeduction = (deduction: Deduction) => { setDeductions((current) => [deduction, ...current]); markChanged() }
  const deleteDeduction = async (id: number) => { if (!await showBusinessConfirm(workspaceName || ownerAccount?.business || 'Your business', 'Remove this deduction?')) return; setDeductions((current) => current.filter((deduction) => deduction.id !== id)); markChanged() }
  const resetSales = async () => { if (!await showBusinessConfirm(workspaceName || ownerAccount?.business || 'Your business', 'Reset current sales? The dated history will be kept.')) return; setSalesHistory((current) => [...current, ...sales]); setSales([]); markChanged() }
  const addInventoryItem = (item: InventoryItem) => { const now = new Date(); setInventory((current) => { const existing = current.find((entry) => entry.name.toLowerCase() === item.name.toLowerCase() && entry.category === item.category && entry.unit === item.unit); const inventoryItemId = existing?.id || item.id; setStockMovements((movements) => [{ id: Date.now(), type: 'Stocked', inventoryItemId, itemName: item.name, category: item.category, quantity: item.quantity, unit: item.unit, reason: 'Stock added', date: today, time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }, ...movements]); if (!existing) return [...current, { ...item, initialQuantity: item.quantity }]; return current.map((entry) => entry.id === existing.id ? { ...entry, quantity: entry.quantity + item.quantity, initialQuantity: (entry.initialQuantity ?? entry.quantity) + item.quantity, reorderAt: item.reorderAt } : entry) }); markChanged(); setAttendanceNotice(`${item.name} stock added successfully`); navigate('Overview') }
  const updateInventoryQuantity = (id: number, amount: number) => { setInventory((current) => current.map((item) => item.id === id ? { ...item, quantity: Math.max(0, item.quantity + amount) } : item)); markChanged() }
  const addExpense = (expense: Expense) => { setExpenses((current) => [expense, ...current]); setStockMovements((current) => [{ ...expense, type: 'Used' }, ...current]); setInventory((current) => current.map((item) => item.id === expense.inventoryItemId ? { ...item, quantity: Math.max(0, item.quantity - expense.quantity) } : item)); markChanged(); setAttendanceNotice(`${expense.itemName} usage recorded successfully`); navigate('Overview') }
  const deleteMember = async (id: number) => {
    const member = members.find((item) => item.id === id)
    if (!member || !await showBusinessConfirm(workspaceName || ownerAccount?.business || 'Your business', `Delete ${member.name} from the team?`)) return
    if (supabase && tenantId) {
      const cleanup = ownerAccount
        ? supabase.rpc('delete_owner_biometric_credential', { requested_tenant_id: tenantId, requested_username: ownerAccount.username, requested_password: ownerAccount.password, requested_member_id: id })
        : supabase.rpc('delete_biometric_credential', { requested_tenant_id: tenantId, requested_member_id: id, requested_credential_id: member.biometricCredentialId || '' })
      const { error } = await cleanup
      if (error) { setAttendanceNotice(`Could not remove ${member.name}'s biometric record. Run the latest Supabase SQL, then try again.`); return }
    }
    setMembers((current) => current.filter((item) => item.id !== id)); markChanged()
  }
  const setMemberCredentials = async (memberId: number, username: string, password: string) => {
    const passwordHash = await hashPassword(password)
    const currentMember = members.find((member) => member.id === memberId)
    if (!currentMember) throw new Error('Member not found')
    const updatedMember = { ...currentMember, username, password: passwordHash, hasAccount: true }
    setMembers((current) => current.map((member) => member.id === memberId ? updatedMember : member))
    markChanged()
    return updatedMember
  }
  ;(window as any).__biztrackSetMemberCredentials = setMemberCredentials
  if (activeNav === 'Admin sign in') return <AdminSignInPage ownerAccount={ownerAccount} members={members.filter((member) => member.tenantId === tenantId && member.hasAccount)} siteAdminAccount={siteAdminReady ? siteAdminAccount : null} onLogin={login} onAdminLogin={(success) => { if (success) { startSiteAdminSession(); navigate('Admin') } }} onNavigate={navigate} />
  if (activeNav === 'Register site admin') return <SiteAdminRegisterPage onRegister={(account) => { void hashPassword(account.password).then(async (passwordHash) => { const nextAccount = { ...account, password: passwordHash }; setSiteAdminAccount(nextAccount); localStorage.setItem(siteAdminAccountKey, JSON.stringify(nextAccount)); if (supabase) await supabase.from('site_admin_accounts').upsert({ id: 1, name: nextAccount.name, username: nextAccount.username, password: nextAccount.password, business: nextAccount.business }); navigate('Admin sign in') }) }} onBack={() => navigate('Admin sign in')} />
  const adminSignOut = () => { endSiteAdminSession(); navigate('Welcome') }
  const adminPages = ['Admin', 'Business', 'Users', 'Register a new business', 'Activation codes', 'Packages', 'Activate business', 'Admin settings', 'Delete']
  const recordRegistrationRequest = async (issue: string, details: { name: string; business: string; phone?: string; email?: string; username?: string; password?: string; industry?: string; plan?: string }) => {
    const passwordHash = details.password ? await hashPassword(details.password) : undefined
    setRegistrationRequests((current) => [{ id: Date.now(), applicantName: details.name || 'Not provided', businessName: details.business || 'Not provided', issue, submittedAt: formatDate(new Date().toISOString()), phone: details.phone, email: details.email, username: details.username, password: passwordHash, industry: details.industry, plan: details.plan as SubscriptionPlan }, ...current])
  }
  if (!startupReady) return <WorkspaceLoadingPage businessName={businessName} />
  if (adminPages.includes(activeNav) && !siteAdminSession) return <AdminSignInPage ownerAccount={ownerAccount} members={members.filter((member) => member.tenantId === tenantId && member.hasAccount)} siteAdminAccount={siteAdminReady ? siteAdminAccount : null} onLogin={login} onAdminLogin={(success) => { if (success) { startSiteAdminSession(); navigate('Admin') } }} onNavigate={navigate} />
  if (activeNav === 'Admin') return <AdminDashboardPage accounts={businessAccounts} activeNav="Dashboard" onNavigate={navigate} onCreate={() => navigate('Register a new business')} onSignOut={adminSignOut} />
  if (activeNav === 'Register a new business') return <AdminBusinessRegistrationWizard packages={packages} defaultPlan={platformSettings.defaultPlan} onNavigate={navigate} onBack={() => navigate('Dashboard')} onCreate={(account, activationCode) => { if (!consumeActivationCode(activationCode, account.plan, account.businessName)) return false; createBusinessAccount(account); startSiteAdminSession(); navigate('Business'); return true }} />
  if (activeNav === 'Activation codes') return <ActivationCodesPage codes={activationCodes} packages={packages} onCreate={createActivationCode} activeNav={activeNav} onNavigate={navigate} onSignOut={adminSignOut} />
  if (activeNav === 'Packages') return <ConfiguredPackagesPage packages={packages} onUpdate={updatePackage} onSave={savePackages} activeNav={activeNav} onNavigate={navigate} onSignOut={adminSignOut} />
  if (activeNav === 'Activate business') return <ActivateBusinessPage accounts={businessAccounts} requests={registrationRequests} reviewDecisions={reviewDecisions} onSaveReviewDecision={saveReviewDecision} onActivateAccount={(accountId) => { const account = businessAccounts.find((item) => item.id === accountId); const packageConfig = account && packages.find((item) => item.name === account.plan); const durationDays = packageConfig ? packageConfig.durationUnit === 'year' ? packageConfig.duration * 365 : packageConfig.durationUnit === 'month' ? packageConfig.duration * 30 : packageConfig.durationUnit === 'week' ? packageConfig.duration * 7 : packageConfig.duration : 30; const nextBilling = account && businessPackageExpired(account) ? new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) : account?.nextBilling; updateSubscription(accountId, { status: 'Active', ...(nextBilling ? { nextBilling } : {}) }); void saveReviewDecision(`account:${accountId}`, 'Activated') }} onDeclineAccount={(accountId) => { updateSubscription(accountId, { status: 'Paused' }); void saveReviewDecision(`account:${accountId}`, 'Declined') }} onActivateRequest={activateClientRegistration} onDeclineRequest={declineClientRegistration} activeNav={activeNav} onNavigate={navigate} onSignOut={adminSignOut} />
  if (activeNav === 'Business') return <BusinessAccountsPage accounts={businessAccounts} activeNav="Business" onNavigate={navigate} onCreate={() => navigate('Register a new business')} onSignOut={adminSignOut} onUpdateStatus={(accountId, updates) => { if (updates.status === 'Paused' && !window.confirm('Are you sure you want to suspend this business? All owners and workers will be unable to log in.')) return; updateSubscription(accountId, updates) }} onDelete={(accountId) => { setDeleteTargetId(accountId); navigate('Delete') }} />
  if (activeNav === 'Delete') { const account = businessAccounts.find((item) => item.id === deleteTargetId); return <DeleteBusinessPage account={account} onCancel={() => navigate('Business')} onDelete={deleteBusinessAccount} /> }
  if (activeNav === 'Users') return <AdminUsersPage accounts={businessAccounts} activeNav={activeNav} onNavigate={navigate} onSignOut={adminSignOut} />
  const savePlatformSettings = async (settings: PlatformSettings) => {
    if (supabase && siteAdminAccount) {
      const { error } = await supabase.rpc('save_platform_settings', {
        requested_username: siteAdminAccount.username,
        requested_password: siteAdminAccount.password,
        requested_platform_name: settings.platformName,
        requested_support_email: settings.supportEmail,
        requested_whatsapp_number: settings.whatsappNumber,
        requested_default_plan: settings.defaultPlan,
        requested_maintenance_mode: settings.maintenanceMode,
      })
      if (error) throw new Error(error.message)
    }
    localStorage.setItem('biztrack-whatsapp-number', settings.whatsappNumber)
    setPlatformSettings(settings)
    setMaintenanceMode(settings.maintenanceMode)
    navigate('Dashboard')
  }
  if (activeNav === 'Admin settings') return <AdminPlatformSettingsShell activeNav="Admin settings" onNavigate={navigate} settings={platformSettings} siteAdminAccount={siteAdminAccount} onSave={savePlatformSettings} />
  const maintenanceView = maintenanceMode || (window.location.pathname.replace(/\/$/, '') === '/welcome' && new URLSearchParams(window.location.search).get('mode') === 'maintenance') || window.location.pathname.replace(/\/$/, '') === '/welcome/mode=maintenance'
  if (!platformSettingsReady && !window.location.pathname.startsWith('/admin')) return <WorkspaceLoadingPage businessName={businessName} />
  if (maintenanceView && !window.location.pathname.startsWith('/admin')) return <MaintenancePage settings={platformSettings} siteAdminAccount={siteAdminAccount} onAdminLogin={() => { startSiteAdminSession(); navigate('Admin') }} onNavigate={navigate} />
  if (ownerAccount && sessionMemberId !== 0 && !remoteWorkspaceLoaded && !window.location.pathname.startsWith('/admin')) return <WorkspaceLoadingPage businessName={businessName} />
  if (activeNav === 'Master') return <SignInPage ownerAccount={ownerAccount} members={members.filter((member) => member.tenantId === tenantId && member.hasAccount)} siteAdminAccount={siteAdminAccount} onLogin={login} onAdminLogin={(success) => { if (success) { startSiteAdminSession(); navigate('Admin') } }} onNavigate={navigate} />
  if (activeNav === 'Welcome') return <WelcomePage onNavigate={navigate} hasOwnerAccount={Boolean(ownerAccount)} businessName={businessName} />
  if (activeNav === 'Terms') return <TermsPage onNavigate={navigate} />
  if (activeNav === 'Register') return <ConfiguredRegisterPage packages={packages} onNavigate={navigate} onRequestIssue={recordRegistrationRequest} onComplete={(account) => { void (async () => { try { await createBusinessAccount({ businessName: account.business || 'New business', ownerName: account.name, email: `${account.username}@biztrack.app`, username: account.username, password: account.password, industry: account.industry || 'General', plan: account.plan || packages[0]?.name || 'Starter' }); setOwnerAccount(null); setSessionMemberId(0); setRemoteWorkspaceLoaded(true); window.history.replaceState({}, '', pagePaths['Sign in']); setActiveNav('Sign in') } catch (error) { const message = error instanceof Error ? error.message : 'Unknown database error'; window.alert(`We could not create your workspace: ${message}. Apply the latest supabase.sql migration if this is a package constraint error.`) } })() }} />
  if (activeNav === 'Sign in') return <CrossDeviceSignInPage ownerAccount={ownerAccount} members={members.filter((member) => member.tenantId === tenantId && member.hasAccount)} businessAccounts={businessAccounts} siteAdminAccount={siteAdminReady ? siteAdminAccount : null} onLogin={login} onBusinessLogin={loginBusinessAccount} onAdminLogin={(success) => { if (success) { startSiteAdminSession(); navigate('Admin') } }} />
  if (siteAdminSession && !ownerAccount) return <AdminDashboardPage accounts={businessAccounts} activeNav="Dashboard" onNavigate={navigate} onCreate={() => navigate('Register a new business')} onSignOut={adminSignOut} />
  if (!ownerAccount) return <WelcomePage onNavigate={navigate} hasOwnerAccount={false} businessName={businessName} />
  if (currentBusinessAccount && businessRequiresActivation(currentBusinessAccount) && sessionMemberId !== 0 && !siteAdminSession) return <SubscriptionRequiredPage expired={businessPackageExpired(currentBusinessAccount)} onSignOut={logout} />
  if (sessionMemberId === 0) return <SignInPage ownerAccount={ownerAccount} members={members.filter((member) => member.tenantId === tenantId && member.hasAccount)} onLogin={login} />
  if (!canAccess(activeNav)) return <AccessDeniedPage onBack={() => navigate('Overview')} />
  if (activeNav === 'Permissions') return <div className="app-shell"><WorkspaceSidebar businessName={businessName} activeNav={activeNav} onNavigate={navigate} onLogout={logout} /><main className="main-content"><header className="topbar"><div className="breadcrumbs"><span>{businessName}</span><b>/</b><strong>Permissions</strong></div></header><div className="page-content"><PermissionsPage members={members} accessByMember={accessByMember} setAccessByMember={setAccessByMember} selectedMemberId={permissionTargetId} onAddMember={() => setAccountChoiceOpen(true)} onSave={(member, grantedPages) => { setAttendanceNotice(`${member.name}, ${member.role}, was granted permission to access ${grantedPages.join(', ') || 'no pages'}`); setPermissionTargetId(null); navigate('Team') }} onCancel={() => navigate('Team')} />{accountChoiceOpen && <AccountChoiceModal onClose={() => setAccountChoiceOpen(false)} onExisting={() => { setAccountChoiceOpen(false); setSelectingExistingAccount(true); navigate('Team') }} onCreate={() => { setAccountChoiceOpen(false); navigate('Add member') }} />}</div></main></div>

  if (activeNav === 'OFF MARK') return <div className="app-shell"><WorkspaceSidebar businessName={businessName} activeNav={activeNav} onNavigate={navigate} onLogout={logout} /><main className="main-content"><header className="topbar"><div className="breadcrumbs"><span>{businessName}</span><b>/</b><strong>OFF MARK</strong></div></header><div className="page-content"><OffMarkPage members={members} attendance={attendance} onMark={(memberIds, dates) => { setAttendance((current) => { const next = [...current]; memberIds.forEach((memberId) => dates.forEach((date) => { const existingIndex = next.findIndex((entry) => entry.memberId === memberId && entry.date === date); const existing = existingIndex >= 0 ? next[existingIndex] : undefined; const hasSignedIn = Boolean(existing && (existing.status === 'Present' || existing.status === 'Late' || existing.checkIn !== '—' || existing.checkOut !== '—')); if (hasSignedIn) return; const entry = { memberId, date, status: 'Off' as AttendanceStatus, checkIn: '—', checkOut: '—' }; if (existingIndex >= 0) next[existingIndex] = { ...next[existingIndex], ...entry }; else next.push(entry) })); return next }); markChanged() }} /></div></main></div>

  if (activeNav === 'Inventory') return <div className="app-shell"><WorkspaceSidebar businessName={businessName} activeNav={activeNav} onNavigate={navigate} onLogout={logout} /><main className="main-content"><header className="topbar"><div className="breadcrumbs"><span>{businessName}</span><b>/</b><strong>Stock movement</strong></div></header><div className="page-content"><StockPage inventory={inventory} expenses={expenses} categories={storeCategories} categoryUnits={categoryUnits} categoryThresholds={categoryThresholds} onAddStock={addInventoryItem} onAddExpense={addExpense} /></div></main></div>
  if (activeNav === 'Print') return <div className="app-shell"><WorkspaceSidebar businessName={businessName} activeNav={activeNav} onNavigate={navigate} onLogout={logout} /><main className="main-content"><header className="topbar"><div className="breadcrumbs"><span>{businessName}</span><b>/</b><strong>Print</strong></div></header><div className="page-content"><PrintPage businessName={businessName} members={members} sales={[...sales, ...salesHistory]} attendance={attendance} deductions={deductions} expenses={expenses} stockMovements={stockMovements} inventory={inventory} currency={currency} /></div></main></div>

  if (activeNav === 'Settings') return <div className="app-shell"><WorkspaceSidebar businessName={businessName} activeNav={activeNav} onNavigate={navigate} onLogout={logout} /><main className="main-content"><header className="topbar"><div className="breadcrumbs"><span>{businessName}</span><b>/</b><strong>Settings</strong></div></header><div className="page-content"><WorkspaceSettingsPage businessName={workspaceName} setBusinessName={setWorkspaceName} currency={currency} setCurrency={setCurrency} paymentMethods={paymentMethods} setPaymentMethods={setPaymentMethods} members={members} defaultSignIn={defaultSignIn} defaultSignOut={defaultSignOut} strictSignIn={strictSignIn} allowMultipleDailyShifts={allowMultipleDailyShifts} setStrictSignIn={setStrictSignIn} setAllowMultipleDailyShifts={setAllowMultipleDailyShifts} categories={storeCategories} setCategories={setStoreCategories} setDefaultSignIn={setDefaultSignIn} setDefaultSignOut={setDefaultSignOut} setMembers={setMembers} onChange={() => markChanged()} /></div></main></div>

  if (activeNav === 'Deductions' || activeNav === 'Penalties') return <div className="app-shell"><WorkspaceSidebar businessName={businessName} activeNav={activeNav} onNavigate={navigate} onLogout={logout} /><main className="main-content"><header className="topbar"><div className="breadcrumbs"><span>{businessName}</span><b>/</b><strong>Deductions</strong></div></header><div className="page-content"><DeductionsPage members={members} deductions={deductions} onAdd={addDeduction} onDelete={deleteDeduction} /></div></main></div>
  if (activeNav === 'Overview') return <div className="app-shell"><WorkspaceSidebar businessName={businessName} activeNav={activeNav} onNavigate={navigate} onLogout={logout} /><main className="main-content"><header className="topbar"><div className="breadcrumbs"><span>{businessName}</span><b>/</b><strong>Overview</strong></div></header><div className="page-content"><LiveWorkspaceOverview businessName={businessName} memberName={dashboardName} memberRole={sessionMemberId === -1 ? 'Owner' : members.find((member) => member.id === sessionMemberId)?.role || role} members={members} attendance={todayAttendance} entries={attendance} sales={sales} inventory={inventory} categoryThresholds={categoryThresholds} onAttendance={() => navigate('Attendance')} /></div></main></div>

  const openAttendanceMode = (page: 'Worker sign-in' | 'Worker checkout', mode: 'individual' | 'bulk') => {
    navigate(page)
    if (mode === 'bulk') window.history.replaceState({}, '', `${pagePaths[page]}?mode=bulk`)
  }
  return <div className="app-shell">
    <WorkspaceSidebar businessName={businessName} activeNav={activeNav} onNavigate={navigate} onLogout={logout} />
    <aside className="sidebar"><a className="brand" href={pagePaths.Overview} onClick={(event) => { event.preventDefault(); navigate('Overview') }}><span className="brand-mark">b</span><span>biz track</span></a><div className="workspace-switcher"><span className="workspace-dot">{businessName.charAt(0).toUpperCase()}</span><span><strong>{businessName}</strong><small>Business workspace</small></span><span className="chevron">⌄</span></div><nav aria-label="Main navigation"><p className="nav-label">WORKSPACE</p>{navItems.map((item) => <a key={item.label} href={pagePaths[item.label]} className={`nav-item ${activeNav === item.label ? 'active' : ''}`} onClick={(event) => { event.preventDefault(); navigate(item.label) }}><span className="nav-icon">{item.icon}</span>{item.label}{item.label === 'Inventory' && <span className="nav-badge">3</span>}</a>)}<p className="nav-label nav-label-spaced">PEOPLE</p><a href={pagePaths.Team} className={`nav-item ${activeNav === 'Team' ? 'active' : ''}`} onClick={(event) => { event.preventDefault(); navigate('Team') }}><span className="nav-icon">◎</span>Team</a><a href={pagePaths['Add member']} className={`nav-item ${activeNav === 'Add member' ? 'active' : ''}`} onClick={(event) => { event.preventDefault(); navigate('Add member') }}><span className="nav-icon">＋</span>Add member</a><a href={pagePaths.Permissions} className={`nav-item ${activeNav === 'Permissions' ? 'active' : ''}`} onClick={(event) => { event.preventDefault(); navigate('Permissions') }}><span className="nav-icon">⌘</span>Permissions</a><a href={pagePaths.ROLL} className={`nav-item ${activeNav === 'ROLL' ? 'active' : ''}`} onClick={(event) => { event.preventDefault(); navigate('ROLL') }}><span className="nav-icon">◷</span>ROLL</a><a href={pagePaths.Settings} className={`nav-item ${activeNav === 'Settings' ? 'active' : ''}`} onClick={(event) => { event.preventDefault(); navigate('Settings') }}><span className="nav-icon">⚙</span>Settings</a></nav><div className="sidebar-footer"><div className="help-mark">?</div><span>Help center</span><button className="sidebar-signout" onClick={logout}><span>↪</span>Sign out</button><button className="collapse-button">‹</button></div></aside>
    <main className="main-content"><header className="topbar"><div className="breadcrumbs"><span>Workspace</span><b>/</b><strong>{activeNav}</strong></div><div className="top-actions"><div className={`sync-status ${isOnline ? 'online' : 'offline'}`}><span className="status-dot"></span>{syncLabel}</div><button className="icon-button" aria-label="Notifications">♧<span className="notification-dot"></span></button><div className="profile-menu"><div className="avatar avatar-olive">KA</div><span><strong>Kemi A.</strong><small>{role}</small></span><span className="chevron">⌄</span></div></div></header><div className="page-content">{activeNav === 'ROLL' ? <RollPage onOpenSignIn={() => navigate('Worker sign-in')} onOpenSignOut={() => navigate('Worker checkout')} /> : activeNav === 'Attendance' ? <AttendancePage members={members} entries={todayAttendance} setMembers={setMembers} onChange={markChanged} /> : activeNav === 'Departments' ? <DepartmentsPage departments={departmentList} members={members} onAdd={() => navigate('Add department')} onDelete={deleteDepartment} /> : activeNav === 'Add department' ? <AddDepartmentPage onSubmit={addDepartment} onCancel={() => navigate('Departments')} /> : activeNav === 'Add member' ? <AddMemberPage departments={departmentList} defaultSignIn={defaultSignIn} defaultSignOut={defaultSignOut} onSubmit={addMember} onCancel={() => navigate('Team')} /> : activeNav === 'Team' ? <TeamPage members={members} onAdd={() => navigate('Add member')} onDelete={deleteMember} /> : activeNav === 'Payroll' ? <PayrollPage members={members} attendance={attendance} /> : activeNav === 'Sales' ? <SalesPage sales={sales} salesHistory={salesHistory} onAdd={addSale} onReset={resetSales} /> : activeNav === 'Inventory' ? <InventoryPage inventory={inventory} categories={storeCategories} onAdd={addInventoryItem} onAdjust={updateInventoryQuantity} /> : activeNav === 'Worker checkout' ? <WorkerSignOutPage members={members} entries={attendance} onMarkSignOut={markMemberSignOut} /> : activeNav === 'Settings' ? <SettingsPage members={members} defaultSignIn={defaultSignIn} defaultSignOut={defaultSignOut} strictSignIn={strictSignIn} setStrictSignIn={setStrictSignIn} categories={storeCategories} setCategories={setStoreCategories} setDefaultSignIn={setDefaultSignIn} setDefaultSignOut={setDefaultSignOut} setMembers={setMembers} onChange={markChanged} /> : activeNav === 'Worker sign-in' ? <LegacyWorkerSignInPage members={members} entries={attendance} strictSignIn={strictSignIn} defaultSignIn={defaultSignIn} onAttendance={toggleCurrentAttendance} onMarkAttendance={markMemberAttendance} onMarkSignOut={markMemberSignOut} /> : <LegacyOverviewPage role={role} setRole={setRole} members={members} isCheckedIn={isCheckedIn} setIsCheckedIn={toggleCurrentAttendance} isOnline={isOnline} onAttendance={() => navigate('Attendance')} />}</div></main>
  </div>
}

  function LiveOverviewPage({ memberName, members, isCheckedIn, setIsCheckedIn, isOnline, onAttendance }: { memberName: string; members: Member[]; isCheckedIn: boolean; setIsCheckedIn: () => void; isOnline: boolean; onAttendance: () => void }) { const [now, setNow] = useState(new Date()); useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 60000); return () => window.clearInterval(timer) }, []); const dateLabel = formatDate(now.toISOString()); const timeLabel = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }); return <LegacyOverviewPage role="Owner" setRole={() => undefined} members={members} isCheckedIn={isCheckedIn} setIsCheckedIn={setIsCheckedIn} isOnline={isOnline} onAttendance={onAttendance} liveMemberName={memberName} liveDate={dateLabel} liveTime={timeLabel} /> }
  function PageHeading({ eyebrow, title, subtitle, action }: { eyebrow: string; title: string; subtitle: string; action?: React.ReactNode }) { return <div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="subheading">{subtitle}</p></div>{action && <div className="heading-actions">{action}</div>}</div> }
function PanelHeading({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) { return <div className="panel-heading"><div><h2>{title}</h2><p>{subtitle}</p></div>{action}</div> }
function Metric({ title, value, detail, accent }: { title: string; value: string; detail: string; accent: string }) { return <article className={`metric-card accent-${accent}`}><div className="metric-top"><span>{title}</span><span className="metric-icon">↗</span></div><strong>{value}</strong><div className="metric-foot"><span className={detail.includes('Needs') ? 'negative' : 'positive'}>{detail}</span></div><div className="progress-track"><span style={{ width: detail.includes('Needs') ? '35%' : '72%' }}></span></div></article> }

function LegacyOverviewPage({ role, setRole, members, isCheckedIn, setIsCheckedIn, isOnline, onAttendance }: { role: Role; setRole: (role: Role) => void; members: Member[]; isCheckedIn: boolean; setIsCheckedIn: () => void; isOnline: boolean; onAttendance: () => void }) { return <><PageHeading eyebrow="MONDAY, 24 JUNE 2024" title="Good morning, Kemi ✦" subtitle="Here’s what’s happening across Biz Track today." action={<><label className="role-select"><span>Viewing as</span><select value={role} onChange={(event) => setRole(event.target.value as Role)}>{roles.map((item) => <option key={item}>{item}</option>)}</select></label><button className="primary-button" onClick={onAttendance}>View attendance <span>→</span></button></>} /><section className="metric-grid"><Metric title="Today’s sales" value="KES 284,500" detail="↑ 12.8% vs. yesterday" accent="coral" /><Metric title="Team attendance" value="18 / 21" detail="85.7% present today" accent="teal" /><Metric title="Payroll this month" value="KES 1.84m" detail="62% of monthly budget" accent="yellow" /><Metric title="Stock alerts" value="03" detail="Needs attention" accent="lilac" /></section><section className="dashboard-grid"><article className="panel attendance-panel"><PanelHeading title="Attendance today" subtitle="Live view of your team’s day" action={<button className="text-button" onClick={onAttendance}>View all <span>→</span></button>} /><div className="attendance-summary"><div><strong>18</strong><span>Present</span></div><div><strong>02</strong><span>Late</span></div><div><strong>01</strong><span>Off today</span></div><div className="attendance-ring"><div><strong>86%</strong><span>of team</span></div></div></div><div className="table-wrap"><table><thead><tr><th>TEAM MEMBER</th><th>DEPARTMENT</th><th>STATUS</th><th>CHECK-IN</th></tr></thead><tbody>{members.slice(0, 4).map((member, index) => <tr key={member.id}><td><div className="person-cell"><span className={`avatar avatar-${member.color}`}>{member.initials}</span><strong>{member.name}</strong></div></td><td>{member.department}</td><td><span className={`status-pill ${index === 2 ? 'late' : 'present'}`}><i></i>{index === 2 ? 'Late' : 'Present'}</span></td><td>{index === 2 ? '09:17 AM' : '08:52 AM'}</td></tr>)}</tbody></table></div></article><article className="panel checkin-panel"><PanelHeading title="Your attendance" subtitle="Keep your day on track" action={<span className="today-tag">TODAY</span>} /><div className="checkin-state"><span className="checkin-icon">{isCheckedIn ? '✓' : '○'}</span><div><strong>{isCheckedIn ? 'You are checked in' : 'You are checked out'}</strong><span>{isCheckedIn ? 'Started at 08:46 AM' : 'Tap below to start your day'}</span></div></div><button className="attendance-button" onClick={setIsCheckedIn}>{isCheckedIn ? 'Check out' : 'Check in'} <span>→</span></button><div className="checkin-note">◷ Automatic sync is {isOnline ? 'on' : 'paused offline'}</div></article></section><section className="lower-grid"><article className="panel insight-panel"><PanelHeading title="Sales performance" subtitle="Revenue across the last 7 days" /><div className="fake-chart"><span>KES 300k</span><div className="chart-bars"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><span>KES 0</span></div></article><article className="panel insight-panel"><PanelHeading title="Inventory watchlist" subtitle="Items that need your attention" action={<button className="text-button">Manage <span>→</span></button>} /><div className="inventory-list"><div className="inventory-item"><span className="product-icon product-red">☕</span><div><strong>Arabica coffee beans</strong><small>Warehouse · 2kg left</small></div><span className="stock-status critical">Critical</span></div><div className="inventory-item"><span className="product-icon product-green">◒</span><div><strong>Fresh milk</strong><small>Cold storage · 8L left</small></div><span className="stock-status low">Low stock</span></div></div></article></section></> }

function AttendancePage({ members, entries, setMembers, onChange }: { members: Member[]; entries: AttendanceEntry[]; setMembers?: React.Dispatch<React.SetStateAction<Member[]>>; onChange?: () => void }) { const counts = { Present: entries.filter((entry) => entry.status === 'Present').length, Late: entries.filter((entry) => entry.status === 'Late').length, Absent: entries.filter((entry) => entry.status === 'Absent').length, Off: entries.filter((entry) => entry.status === 'Off').length }; return <><PageHeading eyebrow="TEAM MANAGEMENT / ATTENDANCE" title="Attendance" subtitle="See how your employees have been showing up each day." action={<button className="filter-button">Today · 24 Jun 2024 <span>⌄</span></button>} /><section className="metric-grid attendance-metrics"><Metric title="Present today" value={String(counts.Present)} detail="Checked in on time" accent="teal" /><Metric title="Late arrivals" value={String(counts.Late).padStart(2, '0')} detail="Needs follow-up" accent="yellow" /><Metric title="Absent" value={String(counts.Absent).padStart(2, '0')} detail="No sign-in recorded" accent="coral" /><Metric title="Team coverage" value="86%" detail="18 of 21 scheduled" accent="lilac" /></section><article className="panel attendance-review"><PanelHeading title="Employee attendance" subtitle="Daily sign-in and sign-out records for your team" action={<button className="filter-button">All departments <span>⌄</span></button>} /><div className="table-wrap"><table><thead><tr><th>EMPLOYEE</th><th>DEPARTMENT</th><th>ROLE</th><th>STATUS</th><th>CHECK-IN</th><th>CHECK-OUT</th></tr></thead><tbody>{entries.map((entry) => { const member = members.find((item) => item.id === entry.memberId); if (!member) return null; return <tr key={member.id}><td><div className="person-cell"><span className={`avatar avatar-${member.color}`}>{member.initials}</span><strong>{member.name}</strong></div></td><td>{member.department}</td><td>{member.role}</td><td><span className={`status-pill ${entry.status.toLowerCase()}`}><i></i>{entry.status}</span></td><td>{entry.checkIn}</td><td>{entry.checkOut}</td></tr> })}</tbody></table></div></article><p className="page-footer"><span><i className="footer-dot"></i> Attendance is saved locally and will sync automatically</span><span>Showing {members.length} team members</span></p></> }

function ExistingAccountTeamPage({ members, onProceed, onBack }: { members: Member[]; onProceed: (id: number) => void; onBack: () => void }) { const accountMembers = members.filter((member) => member.hasAccount === true && Boolean(member.username?.trim() && member.password?.trim())); const [selectedId, setSelectedId] = useState<number | null>(null); return <><PageHeading eyebrow="PEOPLE / TEAM" title="Select an account" subtitle="Choose one existing team member to give workspace access." action={<button className="secondary-button" onClick={onBack}>Back to permissions</button>} /><article className="panel team-panel account-selection-panel"><PanelHeading title="Existing account holders" subtitle="Only one account can be selected." /><div className="table-wrap"><table className="team-members-table"><thead><tr><th>SELECT</th><th>WORKER ID</th><th>TEAM MEMBER</th><th>PHONE</th><th>ID NUMBER</th><th>DEPARTMENT</th></tr></thead><tbody>{accountMembers.map((member) => <tr key={member.id}><td><input type="radio" name="existing-account" checked={selectedId === member.id} onChange={() => setSelectedId(member.id)} aria-label={`Select ${member.name}`} /></td><td><strong>#{member.id}</strong></td><td><div className="person-cell"><span className={`avatar avatar-${member.color}`}>{member.initials}</span><strong>{member.name}</strong></div></td><td>{member.phone}</td><td>#{member.id}</td><td>{member.department}</td></tr>)}</tbody></table></div><div className="team-panel-footer"><button className="primary-button" disabled={!selectedId} onClick={() => selectedId && onProceed(selectedId)}>Proceed</button></div></article></> }

function TeamPage({ members, onAdd, onDelete }: { members: Member[]; onAdd: () => void; onDelete: (id: number) => void }) { const [selectedDepartment, setSelectedDepartment] = useState('All departments'); const departmentOptions = ['All departments', ...Array.from(new Set(members.map((member) => member.department)))]; const visibleMembers = selectedDepartment === 'All departments' ? members : members.filter((member) => member.department === selectedDepartment); return <><PageHeading eyebrow="PEOPLE / TEAM" title="Your team" subtitle="Manage members and keep everyone connected to the right department." /><article className="panel team-panel"><PanelHeading title={`${visibleMembers.length} team members`} subtitle="Contact details and current assignments" action={<select className="filter-button" value={selectedDepartment} onChange={(event) => setSelectedDepartment(event.target.value)}>{departmentOptions.map((department) => <option key={department}>{department}</option>)}</select>} /><div className="table-wrap"><table className="team-members-table"><thead><tr><th>WORKER ID</th><th>TEAM MEMBER</th><th>PHONE</th><th>ID NUMBER</th><th>DEPARTMENT</th><th>ACTION</th></tr></thead><tbody>{visibleMembers.map((member) => <tr key={member.id}><td><strong>#{member.id}</strong></td><td><div className="person-cell"><span className={`avatar avatar-${member.color}`}>{member.initials}</span><strong>{member.name}</strong></div></td><td>{member.phone}</td><td>#{member.id}</td><td>{member.department}</td><td><button className="delete-button" aria-label={`Delete ${member.name}`} onClick={() => onDelete(member.id)}>×</button></td></tr>)}</tbody></table></div><div className="team-panel-footer"><button className="primary-button" onClick={onAdd}><span>＋</span> Add member</button></div></article></> }

function PayrollPage({ members, attendance, onUpdateStatus, onVerifyPayment }: { members: Member[]; attendance: AttendanceEntry[]; onUpdateStatus?: (memberIds: number[], startDate: string, endDate: string, status: PaymentStatus) => void; onVerifyPayment?: (memberId: number) => Promise<boolean> }) {
  const [period, setPeriod] = useState('today')
  const [selectedDay, setSelectedDay] = useState(today)
  const [customStart, setCustomStart] = useState(today)
  const [customEnd, setCustomEnd] = useState(today)
  const [statusFilter, setStatusFilter] = useState('All statuses')
  const [departmentFilter, setDepartmentFilter] = useState('All departments')
  const [selectedMembers, setSelectedMembers] = useState<number[]>([])
  const [detailMemberId, setDetailMemberId] = useState<number | null>(null)
  const range = period === 'today' ? { start: today, end: today } : period === 'day' ? { start: selectedDay, end: selectedDay } : period === 'week' ? { start: currentWeekStart, end: currentWeekEnd } : period === 'custom' ? { start: customStart, end: customEnd } : { start: currentMonthStart, end: today }
  const completedEntries = attendance.filter((entry) => entry.checkOut !== '—' && entry.date >= range.start && entry.date <= range.end)
  const rows = members.map((member) => {
    const entries = completedEntries.filter((entry) => entry.memberId === member.id)
    const unpaidEntries = entries.filter((entry) => entry.paymentStatus !== 'Paid')
    const statuses = entries.length === 0 ? ['No shifts'] : Array.from(new Set(entries.map((entry) => entry.paymentStatus || 'Pending')))
    const status = statuses.length === 1 ? statuses[0] : 'Mixed'
    const rowDeductions = ((window as any).__biztrackDeductions || []).filter((deduction: Deduction) => deduction.memberId === member.id && deduction.date >= range.start && deduction.date <= range.end)
    return { member, entries, unpaidEntries, shifts: unpaidEntries.length, owed: Math.max(0, unpaidEntries.length * member.payRate - rowDeductions.reduce((sum: number, deduction: Deduction) => sum + deduction.amount, 0)), deductions: rowDeductions, status }
  }).filter((row) => departmentFilter === 'All departments' || row.member.department === departmentFilter).filter((row) => statusFilter === 'All statuses' || row.status === statusFilter)
  const departments = ['All departments', ...Array.from(new Set(members.map((member) => member.department)))]
  const totalOwed = rows.reduce((sum, row) => sum + row.owed, 0)
  const visibleIds = rows.map((row) => row.member.id)
  const detailMember = members.find((member) => member.id === detailMemberId)
  const detailEntries = detailMember ? completedEntries.filter((entry) => entry.memberId === detailMember.id) : []
  const detailGross = detailEntries.length * (detailMember?.payRate || 0)
  const detailPaid = detailEntries.filter((entry) => entry.paymentStatus === 'Paid').length * (detailMember?.payRate || 0)
  const detailDeductions = detailMember ? ((window as any).__biztrackDeductions || []).filter((deduction: Deduction) => deduction.memberId === detailMember.id && deduction.date >= range.start && deduction.date <= range.end).reduce((sum: number, deduction: Deduction) => sum + deduction.amount, 0) : 0
  useEffect(() => {
    const table = document.querySelector('.payroll-toolbar + .table-wrap table')
    if (!table) return
    const headers = table.querySelector('thead tr')
    const bodyRows = Array.from(table.querySelectorAll('tbody tr'))
    const viewHeader = document.createElement('th')
    viewHeader.textContent = 'VIEW'
    headers?.appendChild(viewHeader)
    bodyRows.forEach((tableRow, index) => {
      const row = rows[index]
      if (!row) return
      const cell = document.createElement('td')
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'text-button payroll-view-button'
      button.textContent = 'View'
      button.addEventListener('click', () => setDetailMemberId(row.member.id))
      cell.appendChild(button)
      tableRow.appendChild(cell)
    })
    return () => { viewHeader.remove(); bodyRows.forEach((tableRow) => tableRow.lastElementChild?.remove()) }
  }, [rows])
  useEffect(() => {
    document.querySelector('.payroll-detail-dialog')?.remove()
    if (!detailMember) return
    const dialog = document.createElement('div')
    dialog.className = 'payroll-detail-dialog'
    dialog.innerHTML = `<div class="payroll-detail-sheet" role="dialog" aria-modal="true"><button class="payroll-detail-close" aria-label="Close">×</button><p class="eyebrow">EMPLOYEE EARNINGS</p><h2>${detailMember.name}</h2><p class="payroll-detail-id">ID ${detailMember.id} · ${detailMember.department} · ${detailMember.role}</p><div class="payroll-detail-summary"><div><span>Pay rate</span><strong>KES ${detailMember.payRate.toLocaleString()}</strong><small>per ${detailMember.payFrequency.toLowerCase()}</small></div><div><span>Completed shifts</span><strong>${detailEntries.length}</strong><small>in selected period</small></div></div><dl><div><dt>Gross earned</dt><dd>KES ${detailGross.toLocaleString()}</dd></div><div><dt>Paid so far</dt><dd>KES ${detailPaid.toLocaleString()}</dd></div><div><dt>Deductions</dt><dd>KES ${detailDeductions.toLocaleString()}</dd></div><div class="payroll-detail-total"><dt>Net earned</dt><dd>KES ${(detailGross - detailDeductions).toLocaleString()}</dd></div></dl><p class="payroll-detail-note">Gross pay is completed shifts multiplied by the worker's pay rate. Net earned is gross pay less approved deductions.</p></div>`
    const detailRecords = document.createElement('section')
    detailRecords.className = 'payroll-detail-records'
    detailRecords.innerHTML = `<h3>Earnings and deductions</h3>${detailEntries.map((entry) => `<div class="payroll-detail-record"><span>${formatDate(entry.date)}</span><strong>Earning · KES ${detailMember.payRate.toLocaleString()}</strong><b>${entry.paymentStatus || 'Pending'}</b></div>`).join('')}${((window as any).__biztrackDeductions || []).filter((deduction: Deduction) => deduction.memberId === detailMember.id && deduction.date >= range.start && deduction.date <= range.end).map((deduction: Deduction) => `<div class="payroll-detail-record"><span>${formatDate(deduction.date)}</span><strong>Deduction · KES ${deduction.amount.toLocaleString()}</strong><b>Applied</b></div>`).join('') || '<p>No deductions in this period.</p>'}`
    dialog.querySelector('.payroll-detail-sheet')?.appendChild(detailRecords)
    const closeDialog = () => setDetailMemberId(null)
    dialog.addEventListener('click', (event) => { if (event.target === dialog || (event.target as HTMLElement).closest('.payroll-detail-close')) closeDialog() })
    const handleEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') closeDialog() }
    document.addEventListener('keydown', handleEscape)
    document.body.appendChild(dialog)
    return () => { document.removeEventListener('keydown', handleEscape); dialog.remove() }
  }, [detailMember, detailEntries.length, detailGross, detailPaid, detailDeductions])
  const toggleMember = (memberId: number) => setSelectedMembers((current) => current.includes(memberId) ? current.filter((id) => id !== memberId) : [...current, memberId])
  const toggleVisible = () => setSelectedMembers((current) => visibleIds.every((id) => current.includes(id)) ? current.filter((id) => !visibleIds.includes(id)) : Array.from(new Set([...current, ...visibleIds])))
  const updateSelected = async (status: PaymentStatus) => {
    const selectedIds = selectedMembers.filter((id) => visibleIds.includes(id))
    const ids = selectedIds.filter((id) => {
      const entries = rows.find((row) => row.member.id === id)?.entries ?? []
      return entries.some((entry) => canTransitionPaymentStatus(entry.paymentStatus ?? 'Pending', status))
    })
    if (!ids.length) return
    const verifyPayment = onVerifyPayment || (window as any).__biztrackVerifyPayrollPayment
    const verifiedIds: number[] = []
    for (const id of ids) {
      const hasUnpaid = (rows.find((row) => row.member.id === id)?.entries || []).some((entry) => (entry.paymentStatus || 'Pending') !== 'Paid')
      if (status !== 'Paid' || !hasUnpaid || Boolean(verifyPayment && await verifyPayment(id))) verifiedIds.push(id)
    }
    if (!verifiedIds.length) return
    ;(onUpdateStatus || (window as any).__biztrackUpdatePayrollStatus)?.(verifiedIds, range.start, range.end, status)
    setSelectedMembers([])
  }
  const statusClass = (status: string) => status.toLowerCase().replace(' ', '-')
  useEffect(() => {
    const paidButton = Array.from(document.querySelectorAll('.page-heading button')).find((button) => button.textContent?.includes('Mark selected paid'))
    const actions = document.querySelector('.payroll-bulk-actions')
    const pendingButton = actions?.querySelector('button')
    if (paidButton && actions && pendingButton && paidButton.parentElement !== actions) actions.insertBefore(paidButton, pendingButton)
  }, [selectedMembers, rows])
  return <><PageHeading eyebrow="WORKSPACE / PAYROLL" title="Payroll" subtitle="Filter completed shifts, review what each employee is owed, and record payment status." action={<button className="primary-button" onClick={() => updateSelected('Paid')} disabled={!selectedMembers.length}><span>＋</span> Mark selected paid</button>} /><section className="metric-grid"><Metric title="Amount owed" value={`KES ${totalOwed.toLocaleString()}`} detail={`${rows.filter((row) => row.owed > 0).length} employees with unpaid shifts`} accent="yellow" /><Metric title="Filtered shifts" value={String(rows.reduce((sum, row) => sum + row.shifts, 0))} detail="Completed and not paid" accent="teal" /><Metric title="Paid in view" value={`KES ${rows.reduce((sum, row) => sum + (row.entries.length - row.shifts) * row.member.payRate, 0).toLocaleString()}`} detail="Already settled" accent="coral" /><Metric title="Team in view" value={String(rows.length)} detail="Matching employees" accent="lilac" /></section><article className="panel team-panel"><PanelHeading title="Employee pay schedule" subtitle={`Showing ${range.start} to ${range.end}. A new completed shift starts earning again.`} action={<div className="payroll-filters"><select aria-label="Payroll period" className="filter-button" value={period} onChange={(event) => setPeriod(event.target.value)}><option value="month">This month</option><option value="week">This week</option><option value="today">Today</option><option value="day">Particular day</option><option value="custom">Custom range</option></select>{period === 'day' && <input aria-label="Particular day" type="date" value={selectedDay} onChange={(event) => setSelectedDay(event.target.value)} />}{period === 'custom' && <><input aria-label="Start date" type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} /><input aria-label="End date" type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} /></>}</div>} /><div className="payroll-toolbar"><label><span>Department</span><select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}>{departments.map((department) => <option key={department}>{department}</option>)}</select></label><label><span>Payment status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>All statuses</option><option>Pending</option><option>Paid</option><option>On hold</option><option>Mixed</option><option>No shifts</option></select></label><div className="payroll-bulk-actions"><button className="secondary-button" onClick={() => updateSelected('Pending')} disabled={!selectedMembers.length}>Mark pending</button><button className="secondary-button" onClick={() => updateSelected('On hold')} disabled={!selectedMembers.length}>Put on hold</button></div></div><div className="table-wrap"><table><thead><tr><th><input aria-label="Select visible employees" type="checkbox" checked={visibleIds.length > 0 && visibleIds.every((id) => selectedMembers.includes(id))} onChange={toggleVisible} /></th><th>EMPLOYEE</th><th>FREQUENCY</th><th>PAY RATE</th><th>UNPAID SHIFTS</th><th>AMOUNT OWED</th><th>STATUS</th></tr></thead><tbody>{rows.map((row) => <tr key={row.member.id}><td><input aria-label={`Select ${row.member.name}`} type="checkbox" checked={selectedMembers.includes(row.member.id)} onChange={() => toggleMember(row.member.id)} disabled={!row.entries.length} /></td><td><div className="person-cell"><span className={`avatar avatar-${row.member.color}`}>{row.member.initials}</span><strong>{row.member.name}</strong></div></td><td>{row.member.payFrequency}</td><td>KES {row.member.payRate.toLocaleString()} / {row.member.payFrequency === 'Daily' ? 'day' : row.member.payFrequency === 'Weekly' ? 'week' : 'month'}</td><td>{row.shifts}</td><td><strong>KES {row.owed.toLocaleString()}</strong></td><td><span className={`status-pill ${statusClass(row.status)}`}><i></i>{row.status}</span></td></tr>)}</tbody></table></div></article></>
}


function PenaltiesPage(props: { members: Member[]; deductions: Deduction[]; onAdd: (deduction: Deduction) => void; onDelete: (id: number) => void }) {
  useEffect(() => { const heading = document.querySelector('.page-heading h1'); if (heading) heading.textContent = 'Penalties' }, [])
  return <DeductionsPage {...props} />
}

function DeductionsPage({ members, deductions, onAdd, onDelete }: { members: Member[]; deductions: Deduction[]; onAdd: (deduction: Deduction) => void; onDelete: (id: number) => void }) {
  const [selectedMemberId, setSelectedMemberId] = useState(members[0]?.id || '')
  const total = deductions.reduce((sum, deduction) => sum + deduction.amount, 0)
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const memberId = Number(form.get('memberId'))
    const amount = Number(form.get('amount'))
    const reason = String(form.get('reason') || '').trim()
    if (!memberId || amount <= 0 || !reason) return
    onAdd({ id: Date.now(), memberId, amount, reason, date: String(form.get('date') || today) })
    event.currentTarget.reset()
    setSelectedMemberId(members[0]?.id || '')
  }
  return <><PageHeading eyebrow="PEOPLE / PAYROLL" title="Deductions" subtitle="Record approved deductions when an employee needs an amount taken from their pay." action={<span className="deduction-note">Changes save to this workspace</span>} /><section className="metric-grid"><Metric title="Total deducted" value={`KES ${total.toLocaleString()}`} detail={`${deductions.length} recorded deduction${deductions.length === 1 ? '' : 's'}`} accent="coral" /><Metric title="This month" value={`KES ${deductions.filter((deduction) => deduction.date.slice(0, 7) === today.slice(0, 7)).reduce((sum, deduction) => sum + deduction.amount, 0).toLocaleString()}`} detail="Current payroll period" accent="yellow" /><Metric title="Employees affected" value={String(new Set(deductions.map((deduction) => deduction.memberId)).size)} detail="With deductions on file" accent="teal" /><Metric title="Average deduction" value={`KES ${deductions.length ? Math.round(total / deductions.length).toLocaleString() : '0'}`} detail="Across all records" accent="lilac" /></section><div className="deductions-layout"><form className="panel member-form sales-form" onSubmit={submit}><PanelHeading title="Add a deduction" subtitle="Only record deductions that have been reviewed and approved." /><div className="form-grid single-field"><label><span>Employee <b>*</b></span><select name="memberId" value={selectedMemberId} onChange={(event) => setSelectedMemberId(Number(event.target.value))} required>{members.map((member) => <option key={member.id} value={member.id}>{member.name} · {member.department}</option>)}</select></label><label><span>Amount <b>*</b></span><input name="amount" type="number" min="1" step="0.01" placeholder="e.g. 5000" required /></label><label><span>Reason <b>*</b></span><input name="reason" placeholder="e.g. Stock shortage" required /></label><label><span>Effective date <b>*</b></span><input name="date" type="date" defaultValue={today} required /></label></div><div className="form-actions"><button type="submit" className="primary-button"><span>＋</span> Record deduction</button></div></form><article className="panel team-panel"><PanelHeading title="Deduction history" subtitle="Review amounts recorded against employee pay." />{deductions.length ? <div className="table-wrap"><table><thead><tr><th>EMPLOYEE</th><th>REASON</th><th>DATE</th><th>AMOUNT</th><th>ACTION</th></tr></thead><tbody>{deductions.map((deduction) => { const member = members.find((item) => item.id === deduction.memberId); return <tr key={deduction.id}><td><div className="person-cell"><span className={`avatar avatar-${member?.color || 'mint'}`}>{member?.initials || '?'}</span><strong>{member?.name || 'Removed employee'}</strong></div></td><td>{deduction.reason}</td><td>{deduction.date}</td><td><strong>KES {deduction.amount.toLocaleString()}</strong></td><td><button className="delete-button" aria-label={`Remove deduction for ${member?.name || 'employee'}`} onClick={() => onDelete(deduction.id)}>×</button></td></tr>})}</tbody></table></div> : <div className="deductions-empty"><strong>No deductions recorded</strong><p>Approved deductions will appear here for review.</p></div>}</article></div></>
}
function SalesPage({ sales, salesHistory, onAdd, onReset }: { sales: Sale[]; salesHistory: Sale[]; onAdd: (sale: Sale) => void; onReset: () => void }) { const total = sales.reduce((sum, sale) => sum + sale.amount, 0); const cashTotal = sales.filter((sale) => sale.paymentMethod === 'Cash').reduce((sum, sale) => sum + sale.amount, 0); const creditTotal = sales.filter((sale) => sale.paymentMethod === 'Credit').reduce((sum, sale) => sum + sale.amount, 0); const mobileTotal = sales.filter((sale) => sale.paymentMethod === 'Mobile money').reduce((sum, sale) => sum + sale.amount, 0); const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = new FormData(event.currentTarget); onAdd({ id: Date.now(), amount: Number(form.get('amount')), paymentMethod: String(form.get('paymentMethod')) as PaymentMethod, date: today, time: '', cashier: '' }); event.currentTarget.reset() }; const allHistory = [...sales, ...salesHistory]; return <><PageHeading eyebrow="WORKSPACE / SALES" title="Sales" subtitle="Record the total sales received today and track how customers paid." action={<button className="secondary-button" onClick={onReset}>Archive today</button>} /><section className="metric-grid"><Metric title="Today’s sales" value={`KES ${total.toLocaleString()}`} detail={`${sales.length} record${sales.length === 1 ? '' : 's'} today`} accent="coral" /><Metric title="Cash" value={`KES ${cashTotal.toLocaleString()}`} detail="Received in cash" accent="yellow" /><Metric title="Credit" value={`KES ${creditTotal.toLocaleString()}`} detail="Recorded on credit" accent="teal" /><Metric title="Mobile money" value={`KES ${mobileTotal.toLocaleString()}`} detail="Received by mobile money" accent="lilac" /></section><div className="sales-layout"><form className="panel member-form sales-form" onSubmit={submit}><PanelHeading title="Record daily sales" subtitle="Choose where the money was received." /><div className="form-grid single-field"><label><span>Total amount <b>*</b></span><input name="amount" type="number" min="0.01" step="0.01" required placeholder="e.g. 12500" /></label><label><span>Money received through <b>*</b></span><select name="paymentMethod" defaultValue="Cash" required><option>Cash</option><option>Credit</option><option>Mobile money</option></select></label></div><button className="primary-button" type="submit"><span>＋</span> Record sales</button></form><article className="panel team-panel"><PanelHeading title="Sales history" subtitle="Every record includes the registered cashier name and exact recording time." /><div className="table-wrap"><table><thead><tr><th>AMOUNT</th><th>PAYMENT METHOD</th><th>DATE</th><th>TIME</th><th>RECORDED BY</th></tr></thead><tbody>{allHistory.length ? allHistory.map((sale) => <tr key={`${sale.id}-${sale.time}`}><td><strong>KES {sale.amount.toLocaleString()}</strong></td><td><span className="role-pill">{sale.paymentMethod || 'Cash'}</span></td><td>{sale.date}</td><td>{sale.time || 'Time unavailable'}</td><td>{sale.cashier || 'Registered account'}</td></tr>) : <tr><td colSpan={5}>No sales recorded yet.</td></tr>}</tbody></table></div></article></div></> }

function InventoryPage({ inventory, categories, onAdd, onAdjust }: { inventory: InventoryItem[]; categories: string[]; onAdd: (item: InventoryItem) => void; onAdjust: (id: number, amount: number) => void }) { const [category, setCategory] = useState('All'); const visibleItems = category === 'All' ? inventory : inventory.filter((item) => item.category === category); const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = new FormData(event.currentTarget); onAdd({ id: Date.now(), name: String(form.get('name')), category: String(form.get('category')), quantity: Number(form.get('quantity')), unit: String(form.get('unit')), reorderAt: Number(form.get('reorderAt')) }); event.currentTarget.reset() }; return <><PageHeading eyebrow="WORKSPACE / STORE" title="Store inventory" subtitle="See what is in the store, grouped by category, and keep stock levels healthy." /><section className="metric-grid"><Metric title="Items tracked" value={String(inventory.length)} detail="Across all categories" accent="teal" /><Metric title="Low stock" value={String(inventory.filter((item) => item.quantity <= item.reorderAt).length).padStart(2, '0')} detail="Needs restocking" accent="coral" /><Metric title="Categories" value={String(categories.length - 1)} detail="Organized stock" accent="yellow" /><Metric title="Units in store" value={String(inventory.reduce((sum, item) => sum + item.quantity, 0))} detail="Total quantity" accent="lilac" /></section><div className="sales-layout"><form className="panel member-form sales-form" onSubmit={submit}><PanelHeading title="Add stock item" subtitle="Add products, supplies, or ingredients" /><div className="form-grid single-field"><label><span>Item name <b>*</b></span><input name="name" placeholder="e.g. Sugar" required /></label><label><span>Category <b>*</b></span><select name="category"><option>Beverages</option><option>Food</option><option>Dairy</option><option>Supplies</option><option>Retail</option></select></label><label><span>Quantity <b>*</b></span><input name="quantity" type="number" min="0" required placeholder="20" /></label><label><span>Unit <b>*</b></span><input name="unit" placeholder="kg, L, pieces" required /></label><label><span>Reorder at</span><input name="reorderAt" type="number" min="0" defaultValue="5" /></label></div><button className="primary-button" type="submit"><span>＋</span> Add to store</button></form><article className="panel team-panel"><PanelHeading title="Stock by category" subtitle="Adjust quantities when stock arrives or is used" action={<select className="filter-button" value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select>} /><div className="table-wrap"><table><thead><tr><th>ITEM</th><th>CATEGORY</th><th>IN STORE</th><th>STATUS</th><th>ADJUST</th></tr></thead><tbody>{visibleItems.map((item) => <tr key={item.id}><td><strong>{item.name}</strong></td><td><span className="role-pill">{item.category}</span></td><td>{item.quantity} {item.unit}</td><td><span className={`status-pill ${item.quantity <= item.reorderAt ? 'late' : 'present'}`}><i></i>{item.quantity <= item.reorderAt ? 'Low stock' : 'In stock'}</span></td><td><button className="quantity-button" onClick={() => onAdjust(item.id, -1)}>-</button><button className="quantity-button" onClick={() => onAdjust(item.id, 1)}>+</button></td></tr>)}</tbody></table></div></article></div></> }

function StockPage({ inventory, expenses, categories, categoryUnits, categoryThresholds, onAddStock, onAddExpense }: { inventory: InventoryItem[]; expenses: Expense[]; categories: string[]; categoryUnits: Record<string, string>; categoryThresholds: Record<string, number>; onAddStock: (item: InventoryItem) => void; onAddExpense: (expense: Expense) => void }) {
  const [category, setCategory] = useState('All')
  const availableCategories = Array.from(new Set([...categories, ...inventory.map((item) => item.category)])).filter(Boolean)
  const visibleItems = category === 'All' ? inventory : inventory.filter((item) => item.category === category)
  const [stockCategory, setStockCategory] = useState(categories[0] || '')
  const categoryRows = availableCategories.map((name) => { const items = inventory.filter((item) => item.category === name); const used = expenses.filter((expense) => expense.category === name).reduce((sum, expense) => sum + expense.quantity, 0); const stocked = items.reduce((sum, item) => sum + (item.initialQuantity ?? item.quantity), 0); return { name, items, stocked, used, remaining: items.reduce((sum, item) => sum + item.quantity, 0) } })
  const addStock = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = new FormData(event.currentTarget); const selectedCategory = String(form.get('category') || stockCategory); onAddStock({ id: Date.now(), name: String(form.get('name')), category: selectedCategory, quantity: Number(form.get('quantity')), unit: categoryUnits[selectedCategory] || 'pieces', reorderAt: categoryThresholds[selectedCategory] ?? 5 }); event.currentTarget.reset() }
  const addExpense = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = new FormData(event.currentTarget); const item = inventory.find((entry) => entry.id === Number(form.get('inventoryItemId'))); const quantity = Number(form.get('quantity')); if (!item || quantity <= 0 || quantity > item.quantity) return; const now = new Date(); onAddExpense({ id: Date.now(), inventoryItemId: item.id, itemName: item.name, category: item.category, quantity, unit: item.unit, reason: String(form.get('reason')), date: String(form.get('date') || today), time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }); event.currentTarget.reset() }
  const total = (key: 'stocked' | 'used' | 'remaining') => categoryRows.reduce((sum, row) => sum + row[key], 0)
  return <><PageHeading eyebrow="WORKSPACE / STORE" title="Stock movement" subtitle="Record what enters the store, what is used, and what remains by category." /><section className="metric-grid"><Metric title="Stocked" value={String(total('stocked'))} detail="Units added" accent="teal" /><Metric title="Used / consumed" value={String(total('used'))} detail="Units leaving stock" accent="coral" /><Metric title="Remaining" value={String(total('remaining'))} detail="Units currently in store" accent="yellow" /><Metric title="Categories" value={String(categoryRows.length)} detail="Tracked stock groups" accent="lilac" /></section><div className="stock-forms"><form className="panel member-form sales-form" onSubmit={addStock}><PanelHeading title="Add stock" subtitle="All incoming stock is recorded here." /><div className="form-grid single-field"><label><span>Item name <b>*</b></span><input name="name" required /></label><label><span>Category <b>*</b></span><select name="category" required>{availableCategories.map((item) => <option key={item}>{item}</option>)}</select></label><label><span>Quantity added <b>*</b></span><input name="quantity" type="number" min="1" required /></label><label><span>Unit <b>*</b></span><input name="unit" placeholder="kg, pieces" required /></label><label><span>Reorder at</span><input name="reorderAt" type="number" min="0" defaultValue="5" required /></label></div><button className="primary-button" type="submit">＋ Add stock</button></form><form className="panel member-form sales-form" onSubmit={addExpense}><PanelHeading title="Record used / consumed" subtitle="Outgoing stock is deducted from the selected item." /><div className="form-grid single-field"><label><span>Category</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option>All</option>{availableCategories.map((item) => <option key={item}>{item}</option>)}</select></label><label><span>Item <b>*</b></span><select name="inventoryItemId" required>{visibleItems.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.quantity} {item.unit} remaining</option>)}</select></label><label><span>Quantity used <b>*</b></span><input name="quantity" type="number" min="1" required /></label><label><span>Reason <b>*</b></span><input name="reason" placeholder="Kitchen use, issued, damaged" required /></label><label><span>Date <b>*</b></span><input name="date" type="date" defaultValue={today} required /></label></div><button className="primary-button" type="submit" disabled={!visibleItems.length}>− Record usage</button></form></div><article className="panel stock-category-panel"><PanelHeading title="Stock by category" subtitle="Incoming, outgoing, and remaining quantities. Use the forms above to change stock." /><div className="table-wrap"><table><thead><tr><th>Category</th><th>Stocked</th><th>Used / consumed</th><th>Remaining</th><th>Items</th></tr></thead><tbody>{categoryRows.map((row) => <tr key={row.name}><td>{row.name}</td><td>{row.stocked}</td><td>{row.used}</td><td><strong>{row.remaining}</strong></td><td>{row.items.length}</td></tr>)}</tbody></table></div></article></>
}

function ExpensesPage({ expenses, inventory, onAdd }: { expenses: Expense[]; inventory: InventoryItem[]; onAdd: (expense: Expense) => void }) {
  const [category, setCategory] = useState('All')
  const categories = Array.from(new Set(inventory.map((item) => item.category)))
  const visibleItems = category === 'All' ? inventory : inventory.filter((item) => item.category === category)
  const totalUnits = expenses.reduce((sum, expense) => sum + expense.quantity, 0)
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const item = inventory.find((entry) => entry.id === Number(form.get('inventoryItemId')))
    const quantity = Number(form.get('quantity'))
    if (!item || quantity <= 0 || quantity > item.quantity) return
    const now = new Date()
    onAdd({ id: Date.now(), inventoryItemId: item.id, itemName: item.name, category: item.category, quantity, unit: item.unit, reason: String(form.get('reason') || 'Store usage'), date: String(form.get('date') || today), time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) })
    event.currentTarget.reset()
  }
  return <><PageHeading eyebrow="WORKSPACE / STORE" title="Expenses" subtitle="Track stock leaving the store by item, category, reason, and date." /><section className="metric-grid"><Metric title="Expense records" value={String(expenses.length)} detail="Outgoing stock entries" accent="coral" /><Metric title="Units issued" value={String(totalUnits)} detail="Removed from inventory" accent="yellow" /><Metric title="Categories used" value={String(new Set(expenses.map((expense) => expense.category)).size)} detail="Categories with movement" accent="teal" /><Metric title="Items available" value={String(inventory.length)} detail="Linked to inventory" accent="lilac" /></section><div className="sales-layout"><form className="panel member-form sales-form" onSubmit={submit}><PanelHeading title="Record stock leaving" subtitle="Saving an expense automatically reduces stock on hand." /><div className="form-grid single-field"><label><span>Category</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option>All</option>{categories.map((item) => <option key={item}>{item}</option>)}</select></label><label><span>Inventory item <b>*</b></span><select name="inventoryItemId" required>{visibleItems.length ? visibleItems.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.quantity} {item.unit} available</option>) : <option value="">No stock items available</option>}</select></label><label><span>Quantity used <b>*</b></span><input name="quantity" type="number" min="1" required /></label><label><span>Reason <b>*</b></span><input name="reason" placeholder="e.g. Kitchen use, damaged, issued" required /></label><label><span>Date <b>*</b></span><input name="date" type="date" defaultValue={today} required /></label></div><div className="form-actions"><button className="primary-button" type="submit" disabled={!visibleItems.length}>− Record expense</button></div></form><article className="panel inventory-panel"><PanelHeading title="Recent stock movement" subtitle="Outgoing quantities are reflected in Inventory immediately." /><div className="table-wrap"><table><thead><tr><th>Date</th><th>Item</th><th>Category</th><th>Reason</th><th>Quantity</th></tr></thead><tbody>{expenses.slice(0, 12).map((expense) => <tr key={expense.id}><td>{expense.date}<small>{expense.time}</small></td><td>{expense.itemName}</td><td>{expense.category}</td><td>{expense.reason}</td><td>{expense.quantity} {expense.unit}</td></tr>)}</tbody></table></div></article></div></>
}

function DepartmentsPage({ departments, members, onAdd, onDelete }: { departments: string[]; members: Member[]; onAdd: (name: string) => void; onDelete: (name: string) => void }) {
  const [name, setName] = useState('')
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const nextName = name.trim(); if (!nextName) return; (window as any).__biztrackAddDepartment?.(nextName); setName('') }
  return <><PageHeading eyebrow="WORKSPACE / ORGANIZATION" title="Departments" subtitle="Organize your team and see where every employee is assigned." /><section className="settings-stack"><form className="panel member-form" onSubmit={submit}><PanelHeading title="Add a department" subtitle="Create departments here and assign team members from their profiles." /><div className="form-grid"><label><span>Department name</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Customer service" required /></label><div className="form-actions"><button className="primary-button" type="submit"><span>＋</span> Add department</button></div></div></form><article className="panel department-panel"><PanelHeading title={`${departments.length} departments`} subtitle="Available departments in this workspace" /><div className="department-grid">{departments.map((department, index) => <div className="department-card" key={department}><div className={`department-icon department-icon-${index % 4}`}>▦</div><div className="department-card-copy"><h3>{department}</h3><p>{members.filter((member) => member.department === department).length} team members</p></div><button className="delete-button" aria-label={`Delete ${department}`} onClick={() => onDelete(department)}>×</button></div>)}</div></article></section></>
}

function AddDepartmentPage({ onSubmit, onCancel }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void; onCancel: () => void }) { return <><PageHeading eyebrow="WORKSPACE / ORGANIZATION" title="Add a department" subtitle="Create a department to make team assignments easier to manage." /><form className="panel member-form" onSubmit={onSubmit}><div className="form-heading"><div><h2>Department details</h2><p>Give the department a clear name your team will recognize.</p></div><span className="required-note">* Required</span></div><div className="form-grid single-field"><label><span>Department name <b>*</b></span><input name="departmentName" placeholder="e.g. Customer service" required /></label></div><div className="form-actions"><button type="button" className="secondary-button" onClick={onCancel}>Cancel</button><button type="submit" className="primary-button"><span>＋</span> Add department</button></div></form></> }

function AddMemberPage({ departments, defaultSignIn, defaultSignOut, onSubmit, onCancel }: { departments: string[]; defaultSignIn: string; defaultSignOut: string; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onCancel: () => void }) { return <><PageHeading eyebrow="PEOPLE / TEAM" title="Add a team member" subtitle="Create a profile, pay schedule, and attendance schedule." /><form className="panel member-form" onSubmit={onSubmit}><div className="form-heading"><div><h2>Member details</h2><p>Pay is added when the employee completes a sign-in and sign-out shift.</p></div><span className="required-note">* Required</span></div><div className="form-grid"><label><span>Full name <b>*</b></span><input name="fullName" placeholder="e.g. Chidi Okafor" required /></label><label><span>Phone number <b>*</b></span><input name="phone" placeholder="e.g. +234 803 123 4567" required /></label><label><span>ID number</span><input name="email" inputMode="numeric" placeholder="Worker ID number" /></label><label><span>Department <b>*</b></span><select name="department" defaultValue={departments[0]} required>{departments.length ? departments.map((department) => <option key={department}>{department}</option>) : <option value="Unassigned">Unassigned</option>}</select></label><label><span>Pay rate <b>*</b></span><input name="payRate" type="number" min="0" step="0.01" placeholder="1000" required /></label><label><span>Pay frequency <b>*</b></span><select name="payFrequency" defaultValue="Daily"><option>Daily</option><option>Weekly</option><option>Monthly</option></select></label><label><span>Sign-in time</span><input name="signInTime" type="time" defaultValue={defaultSignIn} /></label><label><span>Sign-out time</span><input name="signOutTime" type="time" defaultValue={defaultSignOut} /></label></div><section className="account-access-section"><div><h2>Login account</h2><p>Enable this only if the employee should sign in and receive page access from the owner.</p></div><label className="account-toggle"><input name="hasAccount" type="checkbox" /><span><strong>Give this member a login account</strong><small>Only enabled account holders appear in Permissions.</small></span></label><div className="form-grid account-fields"><label><span>Username</span><input name="username" placeholder="e.g. chidi.okafor" /></label><label><span>Password</span><input name="password" type="password" minLength={6} placeholder="At least 6 characters" /></label></div></section><div className="form-actions"><button type="button" className="secondary-button" onClick={onCancel}>Cancel</button><button type="submit" className="primary-button"><span>＋</span> Add member</button></div></form></> }

function SettingsPage({ members, defaultSignIn, defaultSignOut, strictSignIn, setStrictSignIn, categories, setCategories, setDefaultSignIn, setDefaultSignOut, setMembers, onChange }: { members: Member[]; defaultSignIn: string; defaultSignOut: string; strictSignIn: boolean; setStrictSignIn: (value: boolean) => void; categories: string[]; setCategories: (value: string[]) => void; setDefaultSignIn: (value: string) => void; setDefaultSignOut: (value: string) => void; setMembers: (members: Member[]) => void; onChange: () => void }) { return <><PageHeading eyebrow="WORKSPACE / SETTINGS" title="Settings" subtitle="Set attendance rules and individual employee schedules." /><section className="settings-stack"><article className="panel member-form"><PanelHeading title="Default attendance times" subtitle="New members use these times unless you set a specific schedule." /><div className="form-grid settings-times"><label><span>Default sign-in time</span><input type="time" value={defaultSignIn} onChange={(event) => { setDefaultSignIn(event.target.value); onChange() }} /></label><label><span>Default sign-out time</span><input type="time" value={defaultSignOut} onChange={(event) => { setDefaultSignOut(event.target.value); onChange() }} /></label><label><span>Strict sign-in checks</span><input type="checkbox" checked={strictSignIn} onChange={(event) => { setStrictSignIn(event.target.checked); onChange() }} /></label><label><span>Inventory categories</span><input type="text" value={categories.join(', ')} onChange={(event) => { const nextCategories = event.target.value.split(',').map((item) => item.trim()).filter(Boolean); setCategories(nextCategories.length ? nextCategories : categories); onChange() }} /></label></div></article><article className="panel team-panel"><PanelHeading title="Employee attendance settings" subtitle="Set the expected sign-in and sign-out time for specific people" /><div className="table-wrap"><table><thead><tr><th>EMPLOYEE</th><th>EXPECTED SIGN-IN</th><th>EXPECTED SIGN-OUT</th><th>ACTION</th></tr></thead><tbody>{members.map((member) => <tr key={member.id}><td><div className="person-cell"><span className={`avatar avatar-${member.color}`}>{member.initials}</span><strong>{member.name}</strong></div></td><td><input className="table-input" type="time" value={member.signInTime} onChange={(event) => { setMembers(members.map((item) => item.id === member.id ? { ...item, signInTime: event.target.value } : item)); onChange() }} /></td><td><input className="table-input" type="time" value={member.signOutTime} onChange={(event) => { setMembers(members.map((item) => item.id === member.id ? { ...item, signOutTime: event.target.value } : item)); onChange() }} /></td><td><span className="status-pill present"><i></i>Saved locally</span></td></tr>)}</tbody></table></div></article></section></> }

function LegacyWorkerSignInPage({ members, entries, strictSignIn, defaultSignIn, onAttendance, onMarkAttendance, onMarkSignOut }: { members: Member[]; entries: AttendanceEntry[]; strictSignIn: boolean; defaultSignIn: string; onAttendance: () => void; onMarkAttendance: (memberId: number, status: 'Present' | 'Absent') => boolean | void | Promise<boolean | void>; onMarkSignOut?: (memberId: number) => boolean | Promise<boolean> }) { const [selectedDepartment, setSelectedDepartment] = useState(''); const [selectedWorkerId, setSelectedWorkerId] = useState<number | ''>(''); const departments = Array.from(new Set(members.map((member) => member.department))); const visibleMembers = selectedDepartment ? members.filter((member) => member.department === selectedDepartment) : []; const selectedMember = visibleMembers.find((member) => member.id === selectedWorkerId) ?? null; const selectedEntry = selectedMember ? entries.find((entry) => entry.memberId === selectedMember.id && entry.date === today) : undefined; const isLockedAbsent = selectedEntry?.status === 'Off'; const [selectedStatus, setSelectedStatus] = useState<'Present' | 'Absent'>('Present');

  useEffect(() => {
    if (!selectedMember) {
      setSelectedStatus('Present')
      return
    }
    setSelectedStatus(selectedEntry?.status === 'Off' ? 'Absent' : selectedEntry?.status === 'Absent' ? 'Absent' : 'Present')
  }, [selectedMember, selectedEntry])

  if (new URLSearchParams(window.location.search).get('mode') === 'bulk') return <BulkAttendancePage action="Sign in" members={members} entries={entries} onMarkAttendance={onMarkAttendance} onMarkSignOut={() => false} onSuccess={(count) => (window as any).__attendanceSuccess?.(`${count} worker${count === 1 ? '' : 's'} signed in successfully`)} />

  const handleStatusChange = async (status: 'Present' | 'Absent') => {
    if (!selectedMember || isLockedAbsent) return
    setSelectedStatus(status)
    const success = await onMarkAttendance(selectedMember.id, status)
    if (status === 'Present' && success !== false) (window as any).__attendanceSuccess?.('1 worker signed in successfully')
  }

  return <><PageHeading eyebrow="PEOPLE / SIGN-IN" title="Worker sign-in" subtitle={strictSignIn ? 'Strict sign-in checks are enabled for hourly staff.' : 'Flexible sign-in mode is active for this workspace.'} /><article className="panel member-form worker-attendance-form"><PanelHeading title="Today’s check-in" subtitle="Use the default time or update it from settings." /><div className="worker-attendance-grid"><label className="worker-attendance-field"><span>Department filter</span><select value={selectedDepartment} onChange={(event) => { setSelectedDepartment(event.target.value); setSelectedWorkerId('') }}><option value="">Select department</option>{departments.map((department) => <option key={department} value={department}>{department}</option>)}</select></label><label className="worker-attendance-field"><span>Worker</span><select value={selectedWorkerId} onChange={(event) => setSelectedWorkerId(Number(event.target.value) || '')} disabled={!selectedDepartment}><option value="">{selectedDepartment ? 'Select worker (ID)' : 'Choose a department first'}</option>{visibleMembers.map((member) => <option key={member.id} value={member.id}>{member.name} (ID: {member.id})</option>)}</select></label></div>{selectedMember && <><div className="worker-attendance-detail"><label><span>Registered worker</span><input value={selectedMember.name} readOnly /></label></div><div className="worker-attendance-detail"><label><span>Default sign-in time</span><input value={defaultSignIn} readOnly /></label></div><div className="worker-attendance-actions"><button type="button" className={selectedStatus === 'Present' ? 'primary-button' : 'secondary-button'} disabled={isLockedAbsent || selectedStatus === 'Present'} onClick={() => handleStatusChange('Present')}>Present</button><button type="button" className={selectedStatus === 'Absent' ? 'primary-button' : 'secondary-button'} disabled={isLockedAbsent || selectedStatus === 'Absent'} onClick={() => handleStatusChange('Absent')}>Absent</button>{isLockedAbsent && <span style={{ alignSelf: 'center', color: '#7a5b3f', fontWeight: 600 }}>Off-day lock: absent is fixed</span>}</div>{selectedMember && <div style={{ marginTop: '1rem', display: 'grid', gap: '0.75rem' }}><div className="table-wrap"><table><thead><tr><th>WORKER ID</th><th>NAME</th><th>PHONE</th></tr></thead><tbody>{visibleMembers.map((member) => <tr key={member.id}><td>#{member.id}</td><td>{member.name}</td><td>{member.phone}</td></tr>)}</tbody></table></div></div>}</> }<div className="form-actions"><button type="button" className="primary-button" disabled={!selectedMember || isLockedAbsent} onClick={() => handleStatusChange('Present')}>Mark attendance</button></div></article></> }

function ConfiguredRegisterPage({ packages, onNavigate, onComplete, onRequestIssue }: { packages: PackageConfig[]; onNavigate: (page: string) => void; onComplete: (account: OwnerAccount) => void; onRequestIssue?: (issue: string, details: { name: string; business: string }) => void }) {
  const [step, setStep] = useState(1)
  const availablePackages = packages.filter((item) => item.name && item.active)
  const [details, setDetails] = useState({ name: '', username: '', password: '', phone: '', business: '', industry: '', plan: availablePackages[0]?.name || '', code: '' })
  const [accepted, setAccepted] = useState(false)
  const [error, setError] = useState('')
  const [generatedCode] = useState(() => `BT-${Math.floor(100000 + Math.random() * 900000)}`)
  const selectedPackage = availablePackages.find((item) => item.name === details.plan)
  const update = (event: FormEvent<HTMLInputElement | HTMLSelectElement>) => { const { name, value } = event.currentTarget; setDetails((current) => ({ ...current, [name]: value })) }
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError('')
    if (step === 1 && (!details.name.trim() || details.username.trim().length < 3 || details.password.length < 6 || !details.phone.trim())) { setError('Enter your name, phone, a username of at least 3 characters, and a password of at least 6 characters.'); onRequestIssue?.('Missing or invalid owner details', details); return }
    if (step === 2 && (!details.business.trim() || !details.industry)) { setError('Add your business name and choose an industry.'); return }
    if (step === 3 && (!selectedPackage || !accepted)) { setError('Choose an available package and accept the terms to continue.'); return }
    if (step === 4) { if (details.code.trim().toUpperCase() !== generatedCode) { setError('That confirmation code does not match.'); return } onComplete({ name: details.name.trim(), username: details.username.trim(), password: details.password, business: details.business.trim(), phone: details.phone.trim(), industry: details.industry, plan: details.plan }); return }
    setStep((current) => current + 1)
  }
  const titles = ['Your details', 'Your business', 'Package and terms', 'Confirm purchase']
  return <div className="register-page"><header className="register-header"><button className="welcome-brand" onClick={() => onNavigate('Welcome')}><span className="welcome-mark">b</span><span>biz track</span></button><button className="register-back" onClick={() => onNavigate('Welcome')}>Back to welcome</button></header><main className="register-layout"><section className="register-intro"><p className="welcome-kicker">SET UP YOUR WORKSPACE</p><h1>A clear start for<br /><em>better work.</em></h1><p>Choose the package configured by the site admin for your workspace.</p></section><section className="register-card"><div className="register-progress">{titles.map((title, index) => <div key={title} className={index + 1 <= step ? 'complete' : ''}><b>0{index + 1}</b><span>{title}</span></div>)}</div><form onSubmit={submit}><p className="eyebrow">STEP 0{step} OF 04</p><h2>{titles[step - 1]}</h2>{error && <p className="register-error" role="alert">{error}</p>}{step === 1 && <div className="form-grid register-fields"><label><span>Full name *</span><input name="name" value={details.name} onChange={update} /></label><label><span>Phone number *</span><input name="phone" value={details.phone} onChange={update} /></label><label><span>Username *</span><input name="username" value={details.username} onChange={update} /></label><label><span>Password *</span><input name="password" type="password" value={details.password} onChange={update} /></label></div>}{step === 2 && <div className="form-grid register-fields"><label><span>Business name *</span><input name="business" value={details.business} onChange={update} /></label><label><span>Industry *</span><input name="industry" value={details.industry} onChange={update} placeholder="Retail, hospitality..." /></label></div>}{step === 3 && <div className="package-choice"><label><span>Choose a package *</span><select name="plan" value={details.plan} onChange={update}>{availablePackages.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select></label>{selectedPackage && <article><span>{selectedPackage.duration} {selectedPackage.durationUnit}{selectedPackage.duration === 1 ? '' : 's'}</span><h3>{selectedPackage.name}</h3><strong>KES {selectedPackage.price.toLocaleString()} <small>/ {selectedPackage.duration} {selectedPackage.durationUnit}{selectedPackage.duration === 1 ? '' : 's'}</small></strong><p>{selectedPackage.description}</p><div className="package-features">{selectedPackage.features.map((feature) => <span key={feature}>✓ {feature}</span>)}</div><small>{selectedPackage.seats} seats included</small></article>}<label className="terms-check"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} /><span>I accept the Biz Track terms and conditions.</span></label></div>}{step === 4 && <div className="confirmation-box"><p>Your one-time confirmation code</p><strong>{generatedCode}</strong><label><span>Enter the code above *</span><input name="code" value={details.code} onChange={update} placeholder="BT-000000" /></label></div>}<div className="register-actions"><button type="button" className="secondary-button" onClick={() => step === 1 ? onNavigate('Welcome') : setStep((current) => current - 1)}>{step === 1 ? 'Cancel' : 'Back'}</button><button className="primary-button" type="submit">{step === 4 ? 'Confirm and create workspace' : 'Continue'} <span>→</span></button></div></form></section></main></div>
}

function RegisterPage({ packages, onNavigate, onComplete, onRequestIssue }: { packages: PackageConfig[]; onNavigate: (page: string) => void; onComplete: (account: OwnerAccount) => void; onRequestIssue?: (issue: string, details: { name: string; business: string }) => void }) {
  const [step, setStep] = useState(1)
  const availablePackages = (packages || []).filter((item) => item.name && item.active)
  const [details, setDetails] = useState({ name: '', username: '', password: '', phone: '', business: '', industry: '', plan: availablePackages[0]?.name || '' })
  const [code, setCode] = useState('')
  const [generatedCode] = useState(() => `BT-${Math.floor(100000 + Math.random() * 900000)}`)
  const [error, setError] = useState('')
  const update = (event: FormEvent<HTMLInputElement | HTMLSelectElement>) => { const next = { ...details, [event.currentTarget.name]: event.currentTarget.value }; setDetails(next) }
  const next = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError('')
    if (step === 1 && (!details.name.trim() || details.username.trim().length < 3 || details.password.length < 6 || !details.phone.trim())) { const issue = 'Missing or invalid owner details'; setError('Enter your name, phone, a username of at least 3 characters, and a password of at least 6 characters.'); onRequestIssue?.(issue, details); return }
    if (step === 2 && (!details.business.trim() || !details.industry)) { const issue = 'Missing business name or industry'; setError('Add your business name and choose an industry.'); onRequestIssue?.(issue, details); return }
    if (step === 3) { setStep(4); return }
    if (step === 4) { if (code.trim().toUpperCase() !== generatedCode) { const issue = 'Confirmation code did not match'; setError('That confirmation code does not match.'); onRequestIssue?.(issue, details); return } onComplete({ name: details.name.trim(), username: details.username.trim(), password: details.password, business: details.business.trim(), phone: details.phone.trim(), industry: details.industry, plan: details.plan as SubscriptionPlan }); return }
    setStep(step + 1)
  }
  const stepTitles = ['Your details', 'Your business', 'Terms and package', 'Confirm purchase']
  return <div className="register-page"><header className="register-header"><button className="welcome-brand" onClick={() => onNavigate('Welcome')}><span className="welcome-mark">b</span><span>biz track</span></button><button className="register-back" onClick={() => onNavigate('Welcome')}>Back to welcome</button></header><main className="register-layout"><section className="register-intro"><p className="welcome-kicker">SET UP YOUR WORKSPACE</p><h1>A clear start for<br /><em>better work.</em></h1><p>Take four short steps to create the owner account, choose a package, and open your business workspace.</p><div className="register-assurance"><span>✓</span><div><strong>Owner-led by design</strong><small>You decide who joins and what each person can access.</small></div></div></section><section className="register-card"><div className="register-progress">{stepTitles.map((title, index) => <div key={title} className={index + 1 <= step ? 'complete' : ''}><b>0{index + 1}</b><span>{title}</span></div>)}</div><form onSubmit={next}><p className="eyebrow">STEP 0{step} OF 04</p><h2>{stepTitles[step - 1]}</h2><p className="register-help">{step === 1 ? 'This will be your owner profile and sign-in.' : step === 2 ? 'Tell us where Biz Track will help your team.' : step === 3 ? 'Review the plan and accept the terms to continue.' : 'The system created a purchase code. Enter it to finish.'}</p>{step === 1 && <div className="form-grid register-fields"><label><span>Full name *</span><input name="name" value={details.name} onChange={update} placeholder="e.g. Kemi Adebayo" /></label><label><span>Phone number *</span><input name="phone" value={details.phone} onChange={update} placeholder="e.g. +234 803 123 4567" /></label><label><span>Username *</span><input name="username" value={details.username} onChange={update} placeholder="Choose a username" /></label><label><span>Password *</span><input name="password" type="password" value={details.password} onChange={update} placeholder="At least 6 characters" /></label></div>}{step === 2 && <div className="form-grid register-fields"><label><span>Business name *</span><input name="business" value={details.business} onChange={update} placeholder="e.g. Northstar Cafe" /></label><label><span>Industry *</span><select name="industry" value={details.industry} onChange={update}><option value="">Choose an industry</option><option>Retail</option><option>Restaurant and hospitality</option><option>Professional services</option><option>Other</option></select></label></div>}{step === 3 && <div className="package-choice"><article><span>Recommended</span><h3>Starter workspace</h3><strong>KES 15,000 <small>/ month</small></strong><p>Owner dashboard, attendance, payroll, inventory, sales, and up to 10 team accounts.</p></article><label className="terms-check"><input type="checkbox" required /><span>I accept the Biz Track terms and conditions and understand that package access begins after confirmation.</span></label></div>}{step === 4 && <div className="confirmation-box"><p>Your one-time confirmation code</p><strong>{generatedCode}</strong><label><span>Enter the code above *</span><input value={code} onChange={(event) => setCode(event.target.value)} placeholder="BT-000000" /></label><small>Keep this code private. It confirms the package purchase for this workspace.</small></div>}{error && <p className="register-error">{error}</p>}<div className="register-actions"><button type="button" className="secondary-button" onClick={() => step === 1 ? onNavigate('Welcome') : setStep(step - 1)}>{step === 1 ? 'Cancel' : 'Back'}</button><button className="primary-button" type="submit">{step === 4 ? 'Confirm and create workspace' : step === 3 ? 'Continue to confirmation' : 'Continue'} <span>→</span></button></div></form></section></main></div>
}

function OffMarkPage({ members, attendance, onMark }: { members: Member[]; attendance: AttendanceEntry[]; onMark: (memberIds: number[], dates: string[]) => void }) {
  const tomorrow = new Date()
  tomorrow.setHours(0, 0, 0, 0)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const firstFutureDate = tomorrow.toISOString().slice(0, 10)
  const [date, setDate] = useState(firstFutureDate)
  const [selectedDates, setSelectedDates] = useState<string[]>([firstFutureDate])
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const toggle = (id: number) => setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  const addDate = () => { if (date <= today || selectedDates.includes(date)) return; setSelectedDates((current) => [...current, date].sort()) }
  const removeDate = (value: string) => setSelectedDates((current) => current.filter((item) => item !== value))
  const alreadyOff = (id: number) => selectedDates.length > 0 && selectedDates.every((value) => attendance.some((entry) => entry.memberId === id && entry.date === value && entry.status === 'Off'))
  const signedIn = (id: number) => selectedDates.some((value) => attendance.some((entry) => entry.memberId === id && entry.date === value && (entry.status === 'Present' || entry.status === 'Late' || entry.checkIn !== '—' || entry.checkOut !== '—')))
  return <><PageHeading eyebrow="PEOPLE / ATTENDANCE" title="OFF MARK" subtitle="Choose one or more future dates. Consecutive and separate days are supported." /><article className="panel member-form off-mark-panel"><div className="off-date-editor"><div><strong>Future off dates</strong><small>Only dates after today are valid.</small></div><div className="off-date-controls"><input className="filter-button" type="date" min={today} value={date} onChange={(event) => setDate(event.target.value)} /><button type="button" className="secondary-button" onClick={addDate}>Add date</button></div></div><div className="off-date-list">{selectedDates.map((value) => <span className="off-date-chip" key={value}>{value}<button type="button" aria-label={`Remove ${value}`} onClick={() => removeDate(value)}>×</button></span>)}</div><PanelHeading title="Select workers to mark off" subtitle={`${selectedIds.length} worker${selectedIds.length === 1 ? '' : 's'} selected for ${selectedDates.length} date${selectedDates.length === 1 ? '' : 's'}.`} /><div className="off-mark-list">{members.map((member) => <label className={`off-mark-worker ${selectedIds.includes(member.id) ? 'selected' : ''}`} key={member.id}><input type="checkbox" checked={selectedIds.includes(member.id)} disabled={signedIn(member.id)} onChange={() => toggle(member.id)} /><span className={`avatar avatar-${member.color}`}>{member.initials}</span><span><strong>{member.name}</strong><small>{member.role} · {member.department}</small></span><b>{signedIn(member.id) ? 'Signed in' : alreadyOff(member.id) ? 'Already off' : selectedIds.includes(member.id) ? 'Selected' : 'Working'}</b></label>)}</div><div className="form-actions"><button className="primary-button" disabled={!selectedIds.length || !selectedDates.length} onClick={() => { onMark(selectedIds, selectedDates); setSelectedIds([]) }}>Mark off</button></div></article></>
}

function PrintPage({ businessName, members, sales, attendance, deductions, expenses, stockMovements, inventory, currency }: { businessName: string; members: Member[]; sales: Sale[]; attendance: AttendanceEntry[]; deductions: Deduction[]; expenses: Expense[]; stockMovements: StockMovement[]; inventory: InventoryItem[]; currency: string }) {
  const [selectedReport, setSelectedReport] = useState('overview')
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [showSummaryPrint, setShowSummaryPrint] = useState(false)
  const [exportPeriod, setExportPeriod] = useState('month')
  const [exportStart, setExportStart] = useState(currentMonthStart)
  const [exportEnd, setExportEnd] = useState(today)
  const inExportRange = (date: string) => date >= exportStart && date <= exportEnd
  const periodSales = sales.filter((sale) => inExportRange(sale.date))
  const completedShifts = attendance.filter((entry) => entry.paymentStatus === 'Paid' && entry.checkOut !== '—' && inExportRange(entry.date))
  const offDays = attendance.filter((entry) => entry.status === 'Off' && inExportRange(entry.date))
  const attendanceRows = datesBetween(exportStart, exportEnd).flatMap((date) => members.map((member) => ({ date, member, entry: attendance.find((item) => item.memberId === member.id && item.date === date) })))
  const attendanceCounts = attendanceRows.reduce((counts, row) => { const status = row.entry?.status || 'Absent'; counts[status] += 1; return counts }, { Present: 0, Late: 0, Absent: 0, Off: 0 } as Record<AttendanceStatus, number>)
    const payrollWorkers = members.map((member) => {
      const earnings = completedShifts.filter((entry) => entry.memberId === member.id)
      const workerDeductions = deductions.filter((deduction) => deduction.memberId === member.id && inExportRange(deduction.date))
      const gross = earnings.length * member.payRate
      const deducted = workerDeductions.reduce((sum, deduction) => sum + deduction.amount, 0)
      return { member, earnings, deductions: workerDeductions, gross, deducted, net: Math.max(0, gross - deducted) }
    }).filter((worker) => worker.earnings.length > 0)
    if (false) {
    return <div className="print-page"><PageHeading eyebrow="WORKSPACE / PRINT" title="Business reports" subtitle="Choose a report and export a clean PDF for records, review, or sharing." action={<button className="primary-button print-all-button" onClick={() => printReport('overview')}><span>▤</span> Print summary</button>} /><section className="print-report-grid">{cards.map((card) => <article className={`print-report-card accent-${card.accent}`} key={card.id}><div className="print-card-icon">{card.icon}</div><div><p>{card.title}</p><strong>{card.value}</strong><small>{card.detail}</small></div><button className="secondary-button" onClick={() => printReport(card.id)}>Export PDF <span>↗</span></button></article>)}</section><article className="panel print-preview"><PanelHeading title={reportNames[selectedReport]} subtitle="The selected report will be printed with the business name and current records." /><div className="print-preview-summary"><strong>{businessName}</strong><span>{exportStart} to {exportEnd}</span></div>{selectedReport === 'payroll' ? <div className="payroll-print-workers">{payrollWorkers.length ? payrollWorkers.map(({ member, earnings, deductions: workerDeductions, gross, deducted, net }) => <section className="payroll-print-worker" key={member.id}><header><div><h3>{member.name}</h3><span>{member.department} · {member.payFrequency} pay · {currency} {member.payRate.toLocaleString()} per shift</span></div><strong>{currency} {net.toLocaleString()} <small>received</small></strong></header><table><thead><tr><th>Date</th><th>Description</th><th>Amount</th></tr></thead><tbody>{earnings.map((entry) => <tr key={`${member.id}-${entry.date}`}><td>{entry.date}</td><td>Completed shift</td><td>{currency} {member.payRate.toLocaleString()}</td></tr>)}{workerDeductions.map((deduction) => <tr className="payroll-print-deduction" key={`deduction-${deduction.id}`}><td>{deduction.date}</td><td>Deduction: {deduction.reason}</td><td>- {currency} {deduction.amount.toLocaleString()}</td></tr>)}<tr className="payroll-print-total"><td colSpan={2}>Gross {currency} {gross.toLocaleString()} less deductions {currency} {deducted.toLocaleString()}</td><td>{currency} {net.toLocaleString()}</td></tr></tbody></table></section>) : <p className="print-empty">No payroll records in this period.</p>}</div> : <div className="print-preview-list">{selectedReport === 'sales' && sales.slice(-6).reverse().map((sale) => <div key={sale.id}><span>{sale.date} · {sale.cashier}</span><strong>{currency} {sale.amount.toLocaleString()}</strong></div>)}{selectedReport === 'off' && offDays.slice(-6).reverse().map((entry) => <div key={`${entry.memberId}-${entry.date}`}><span>{members.find((member) => member.id === entry.memberId)?.name || 'Worker'}</span><strong>{entry.date}</strong></div>)}{selectedReport === 'inventory' && inventory.slice(0, 6).map((item) => <div key={item.id}><span>{item.name} · {item.category}</span><strong>{item.quantity} {item.unit}</strong></div>)}{selectedReport === 'overview' && <><div><span>Sales in period</span><strong>{currency} {salesTotal.toLocaleString()}</strong></div><div><span>Payroll in period</span><strong>{currency} {payrollTotal.toLocaleString()}</strong></div><div><span>Completed shifts</span><strong>{completedShifts.length}</strong></div></>}</div>}</article>{showExportDialog && null}</div>
    }
  const salesTotal = periodSales.reduce((sum, sale) => sum + sale.amount, 0)
  const payrollTotal = completedShifts.reduce((sum, entry) => sum + (members.find((member) => member.id === entry.memberId)?.payRate || 0), 0)
  const reportNames: Record<string, string> = { overview: 'Business summary', sales: 'Sales report', payroll: 'Payroll report', expenses: 'Expenses report', off: 'OFF MARK report', inventory: 'Inventory report' }
  const selectReport = (report: string) => { setSelectedReport(report); document.querySelector('.print-preview')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }
  const openExport = (report: string) => { setSelectedReport(report); setShowExportDialog(true) }
  const printReport = (report?: string) => { const reportToPrint = report || selectedReport; if (report) setSelectedReport(report); setShowExportDialog(false); setShowSummaryPrint(reportToPrint === 'overview'); const dateLabel = document.querySelector('.print-preview-summary span'); if (dateLabel) dateLabel.textContent = `${formatDate(exportStart)} to ${formatDate(exportEnd)}`; window.setTimeout(() => window.print(), 80) }
  const expenseQuantity = expenses.reduce((sum, expense) => sum + expense.quantity, 0)
  const addedQuantity = inventory.reduce((sum, item) => sum + (item.initialQuantity ?? item.quantity), 0)
  const remainingQuantity = inventory.reduce((sum, item) => sum + item.quantity, 0)
  const cards = [
    { id: 'sales', title: 'Sales', value: `${currency} ${salesTotal.toLocaleString()}`, detail: `${periodSales.length} recorded sale${periodSales.length === 1 ? '' : 's'}`, accent: 'coral', icon: '↗' },
    { id: 'payroll', title: 'Payroll', value: `${currency} ${payrollTotal.toLocaleString()}`, detail: `${completedShifts.length} completed shift${completedShifts.length === 1 ? '' : 's'}`, accent: 'yellow', icon: 'KES' },
    { id: 'off', title: 'OFF MARK', value: String(attendanceRows.length), detail: `${attendanceCounts.Present} present · ${attendanceCounts.Late} late · ${attendanceCounts.Absent} absent · ${attendanceCounts.Off} off`, accent: 'teal', icon: '◉' },
    { id: 'inventory', title: 'Stock movement', value: String(remainingQuantity), detail: `${addedQuantity} added · ${expenseQuantity} used · ${remainingQuantity} remaining`, accent: 'lilac', icon: '□' },
  ]
  useEffect(() => {
    const reportIds: Record<string, string> = { Sales: 'sales', Payroll: 'payroll', Expenses: 'expenses', 'OFF MARK': 'off', Inventory: 'inventory', 'Stock movement': 'inventory' }
    const handleReportClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (target.closest('.print-all-button')) { event.preventDefault(); event.stopPropagation(); setSelectedReport('overview'); setShowExportDialog(true); return }
      const card = target.closest('.print-report-card') as HTMLElement | null
      if (!card) return
      const title = card.querySelector('p')?.textContent || ''
      const report = reportIds[title]
      if (!report) return
      const button = target.closest('button')
      if (!button) { setSelectedReport(report); document.querySelector('.print-preview')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return }
      event.preventDefault(); event.stopPropagation(); setSelectedReport(report); setShowExportDialog(true)
    }
    document.addEventListener('click', handleReportClick, true)
    return () => document.removeEventListener('click', handleReportClick, true)
  }, [])
  useEffect(() => {
    if (!showExportDialog) return
    const overlay = document.createElement('div')
    overlay.className = 'print-dialog-backdrop'
    overlay.innerHTML = `<section class="print-dialog" role="dialog" aria-modal="true"><button class="print-dialog-close" aria-label="Close">×</button><p class="eyebrow">EXPORT REPORT</p><h2>${reportNames[selectedReport]}</h2><p class="print-dialog-copy">Choose the dates to include in this PDF report.</p><label>Period<select class="print-period"><option value="today">Today</option><option value="week">This week</option><option value="month" selected>This month</option><option value="custom">Custom dates</option></select></label><div class="print-custom-dates"><label>From<input type="date" value="${exportStart}"></label><label>To<input type="date" value="${exportEnd}"></label></div><button class="primary-button print-dialog-confirm">Print / Save PDF</button></section>`
    const close = () => setShowExportDialog(false)
    overlay.addEventListener('click', (event) => { if (event.target === overlay || (event.target as HTMLElement).closest('.print-dialog-close')) close() })
    overlay.querySelector('.print-period')?.addEventListener('change', (event) => { const value = (event.target as HTMLSelectElement).value; setExportPeriod(value); if (value === 'today') { setExportStart(today); setExportEnd(today) } else if (value === 'week') { setExportStart(currentWeekStart); setExportEnd(currentWeekEnd) } else if (value === 'month') { setExportStart(currentMonthStart); setExportEnd(today) } })
    const customInputs = overlay.querySelectorAll('.print-custom-dates input')
    customInputs[0]?.addEventListener('change', (event) => setExportStart((event.target as HTMLInputElement).value))
    customInputs[1]?.addEventListener('change', (event) => setExportEnd((event.target as HTMLInputElement).value))
    overlay.querySelector('.print-dialog-confirm')?.addEventListener('click', () => printReport())
    document.body.appendChild(overlay)
    return () => overlay.remove()
  }, [showExportDialog, selectedReport, exportStart, exportEnd])
  useEffect(() => {
    const resetReport = () => { setSelectedReport('overview'); setShowSummaryPrint(false) }
    window.addEventListener('afterprint', resetReport)
    return () => window.removeEventListener('afterprint', resetReport)
  }, [])
  if (!showExportDialog && showSummaryPrint) return <SummaryPrintReport businessName={businessName} members={members} sales={periodSales} attendanceRows={attendanceRows} inventory={inventory} stockMovements={stockMovements} currency={currency} exportStart={exportStart} exportEnd={exportEnd} />
  if (!showExportDialog && selectedReport === 'payroll') return <PayrollPrintReport businessName={businessName} members={members} attendance={attendance} deductions={deductions} currency={currency} exportStart={exportStart} exportEnd={exportEnd} />
  if (!showExportDialog && selectedReport !== 'overview') return <UnifiedPrintReport businessName={businessName} report={selectedReport} members={members} sales={sales} attendance={attendance} expenses={expenses} stockMovements={stockMovements} inventory={inventory} currency={currency} exportStart={exportStart} exportEnd={exportEnd} />
  return <div className="print-page"><PageHeading eyebrow="WORKSPACE / PRINT" title="Business reports" subtitle="Choose a report and export a clean PDF for records, review, or sharing." action={<button className="primary-button print-all-button" onClick={() => printReport('overview')}><span>▤</span> Print summary</button>} /><section className="print-report-grid">{cards.map((card) => <article className={`print-report-card accent-${card.accent}`} key={card.id}><div className="print-card-icon">{card.icon}</div><div><p>{card.title}</p><strong>{card.value}</strong><small>{card.detail}</small></div><button className="secondary-button" onClick={() => printReport(card.id)}>Export PDF <span>↗</span></button></article>)}</section><article className="panel print-preview"><PanelHeading title={reportNames[selectedReport]} subtitle="The selected report will be printed with the business name and current records." /><div className="print-preview-summary"><strong>{businessName}</strong><span>{new Date().toLocaleDateString()}</span></div><div className="print-preview-list">{selectedReport === 'sales' && sales.slice(-6).reverse().map((sale) => <div key={sale.id}><span>{sale.date} · {sale.cashier}</span><strong>{currency} {sale.amount.toLocaleString()}</strong></div>)}{selectedReport === 'payroll' && completedShifts.slice(-6).reverse().map((entry) => <div key={`${entry.memberId}-${entry.date}`}><span>{members.find((member) => member.id === entry.memberId)?.name || 'Worker'} · {entry.date}</span><strong>{currency} {(members.find((member) => member.id === entry.memberId)?.payRate || 0).toLocaleString()}</strong></div>)}{selectedReport === 'off' && offDays.slice(-6).reverse().map((entry) => <div key={`${entry.memberId}-${entry.date}`}><span>{members.find((member) => member.id === entry.memberId)?.name || 'Worker'}</span><strong>{entry.date}</strong></div>)}{selectedReport === 'inventory' && inventory.slice(0, 6).map((item) => <div key={item.id}><span>{item.name} · {item.category}</span><strong>{item.quantity} {item.unit}</strong></div>)}{selectedReport === 'overview' && <><div><span>Total sales</span><strong>{currency} {salesTotal.toLocaleString()}</strong></div><div><span>Completed shifts</span><strong>{completedShifts.length}</strong></div><div><span>Scheduled days off</span><strong>{offDays.length}</strong></div><div><span>Stock items</span><strong>{inventory.length}</strong></div></>}</div></article></div>
}

function SummaryPrintReport({ businessName, members, sales, attendanceRows, inventory, stockMovements, currency, exportStart, exportEnd }: { businessName: string; members: Member[]; sales: Sale[]; attendanceRows: { date: string; member: Member; entry?: AttendanceEntry }[]; inventory: InventoryItem[]; stockMovements: StockMovement[]; currency: string; exportStart: string; exportEnd: string }) {
  const paidPayroll = attendanceRows.filter((row) => row.entry?.paymentStatus === 'Paid').reduce((sum, row) => sum + row.member.payRate, 0)
  const salesTotal = sales.reduce((sum, sale) => sum + sale.amount, 0)
  const stocked = (itemId: number) => stockMovements.filter((movement) => movement.inventoryItemId === itemId && movement.type === 'Stocked').reduce((sum, movement) => sum + movement.quantity, 0)
  const used = (itemId: number) => stockMovements.filter((movement) => movement.inventoryItemId === itemId && movement.type === 'Used').reduce((sum, movement) => sum + movement.quantity, 0)
  return <div className="print-page unified-print-page"><article className="panel print-preview"><header className="payroll-print-header"><p className="eyebrow">BUSINESS REPORT</p><h1>{businessName}</h1><h2>Business summary</h2><p className="payroll-print-period">From {exportStart} to {exportEnd}<span>AS AT {new Date().toLocaleDateString()} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span></p></header><section className="print-summary-grid"><div><span>Total sales</span><strong>{currency} {salesTotal.toLocaleString()}</strong></div><div><span>Paid payroll</span><strong>{currency} {paidPayroll.toLocaleString()}</strong></div><div><span>Attendance records</span><strong>{attendanceRows.length}</strong></div></section><h3 className="print-section-title">Attendance details</h3><table className="unified-report-table"><thead><tr><th>Date</th><th>Worker</th><th>Status</th><th>Check-in</th><th>Check-out</th></tr></thead><tbody>{attendanceRows.map((row) => <tr key={`${row.member.id}-${row.date}`}><td>{row.date}</td><td>{row.member.name}</td><td>{row.entry?.status || 'Absent'}</td><td>{row.entry?.checkIn || '—'}</td><td>{row.entry?.checkOut || '—'}</td></tr>)}</tbody></table></article><article className="panel print-preview print-store-page"><header className="payroll-print-header"><p className="eyebrow">STORE / INVENTORY</p><h1>{businessName}</h1><h2>Inventory and store information</h2><p className="payroll-print-period">Stock position and movement summary<span>AS AT {new Date().toLocaleDateString()}</span></p></header><table className="unified-report-table"><thead><tr><th>Item</th><th>Category</th><th>Stocked</th><th>Used</th><th>Remaining</th><th>Unit</th></tr></thead><tbody>{inventory.length ? inventory.map((item) => <tr key={item.id}><td>{item.name}</td><td>{item.category}</td><td>{stocked(item.id)}</td><td>{used(item.id)}</td><td>{item.quantity}</td><td>{item.unit}</td></tr>) : <tr><td colSpan={6}>No inventory items recorded.</td></tr>}</tbody></table><h3 className="print-section-title">Recent store movements</h3><table className="unified-report-table"><thead><tr><th>Date</th><th>Type</th><th>Item</th><th>Quantity</th><th>Reason</th></tr></thead><tbody>{stockMovements.filter((movement) => movement.date >= exportStart && movement.date <= exportEnd).map((movement) => <tr key={movement.id}><td>{movement.date}</td><td>{movement.type}</td><td>{movement.itemName}</td><td>{movement.quantity} {movement.unit}</td><td>{movement.reason}</td></tr>)}</tbody></table></article></div>
}

function AttendancePrintReport({ businessName, members, attendance, currency, exportStart, exportEnd }: { businessName: string; members: Member[]; attendance: AttendanceEntry[]; currency: string; exportStart: string; exportEnd: string }) {
  const attendanceFor = (memberId: number, date: string) => {
    const matches = attendance.filter((item) => item.memberId === memberId && item.date === date)
    return matches.find((item) => item.status === 'Present' || item.status === 'Late' || item.checkIn !== '—' || item.checkOut !== '—') || matches[matches.length - 1]
  }
  const statusFor = (entry?: AttendanceEntry) => entry && entry.status === 'Absent' && (entry.checkIn !== '—' || entry.checkOut !== '—') ? 'Present' : entry?.status || 'Absent'
  const rows = datesBetween(exportStart, exportEnd).flatMap((date) => members.map((member) => ({ date, member, entry: attendanceFor(member.id, date) })))
  const dates = Array.from(new Set(rows.map((row) => row.date)))
  return <div className="print-page unified-print-page"><article className="panel print-preview"><header className="payroll-print-header"><p className="eyebrow">BUSINESS REPORT</p><h1>{businessName}</h1><h2>Attendance report</h2><p className="payroll-print-period">From {formatDate(exportStart)} to {formatDate(exportEnd)}<span>AS AT {formatDate(new Date().toISOString())} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span></p></header>{dates.map((date) => <section className="attendance-print-day" key={date}><h3>{formatDate(date)}</h3><table className="unified-report-table"><thead><tr><th>Worker</th><th>Status</th><th>Check-in</th><th>Check-out</th><th>Payment</th></tr></thead><tbody>{rows.filter((row) => row.date === date).map((row) => <tr key={`${row.member.id}-${row.date}`}><td>{row.member.name}</td><td>{statusFor(row.entry)}</td><td>{row.entry?.checkIn || '—'}</td><td>{row.entry?.checkOut || '—'}</td><td>{row.entry?.paymentStatus || '—'}</td></tr>)}</tbody></table></section>)}</article></div>
}

function UnifiedPrintReport({ businessName, report, members, sales, attendance, expenses, stockMovements, inventory, currency, exportStart, exportEnd }: { businessName: string; report: string; members: Member[]; sales: Sale[]; attendance: AttendanceEntry[]; expenses: Expense[]; stockMovements: StockMovement[]; inventory: InventoryItem[]; currency: string; exportStart: string; exportEnd: string }) {
  const printedAt = new Date()
  const periodSales = sales.filter((sale) => sale.date >= exportStart && sale.date <= exportEnd)
  const reportTitle = report === 'sales' ? 'Sales report' : report === 'expenses' ? 'Expenses report' : report === 'off' ? 'OFF MARK report' : 'Inventory report'
  const periodExpenses = expenses.filter((expense) => expense.date >= exportStart && expense.date <= exportEnd)
  if (report === 'inventory') return <StockPrintReport businessName={businessName} inventory={inventory} stockMovements={stockMovements} currency={currency} exportStart={exportStart} exportEnd={exportEnd} />
  if (report === 'off') return <AttendancePrintReport businessName={businessName} members={members} attendance={attendance} currency={currency} exportStart={exportStart} exportEnd={exportEnd} />
  return <div className="print-page unified-print-page"><article className="panel print-preview"><header className="payroll-print-header"><p className="eyebrow">BUSINESS REPORT</p><h1>{businessName}</h1><h2>{reportTitle}</h2><p className="payroll-print-period">From {exportStart} to {exportEnd}<span>AS AT {printedAt.toLocaleDateString()} {printedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span></p></header><table className="unified-report-table"><thead><tr>{report === 'sales' && <><th>Date</th><th>Time</th><th>Cashier</th><th>Payment method</th><th>Amount</th></>}{report === 'expenses' && <><th>Date</th><th>Time</th><th>Item</th><th>Category</th><th>Reason</th><th>Quantity used</th></>}{report === 'off' && <><th>Date</th><th>Worker</th><th>Status</th></>}{report === 'inventory' && <><th>Item</th><th>Category</th><th>Added</th><th>Used</th><th>Remaining</th><th>Unit</th></>}</tr></thead><tbody>{report === 'sales' && periodSales.map((sale) => <tr key={sale.id}><td>{sale.date}</td><td>{sale.time || '—'}</td><td>{sale.cashier || '—'}</td><td>{sale.paymentMethod}</td><td>{currency} {sale.amount.toLocaleString()}</td></tr>)}{report === 'expenses' && periodExpenses.map((expense) => <tr key={expense.id}><td>{expense.date}</td><td>{expense.time}</td><td>{expense.itemName}</td><td>{expense.category}</td><td>{expense.reason}</td><td>{expense.quantity} {expense.unit}</td></tr>)}{report === 'off' && attendance.filter((entry) => entry.status === 'Off' && entry.date >= exportStart && entry.date <= exportEnd).map((entry) => <tr key={`${entry.memberId}-${entry.date}`}><td>{entry.date}</td><td>{members.find((member) => member.id === entry.memberId)?.name || `Worker ${entry.memberId}`}</td><td>OFF</td></tr>)}{report === 'inventory' && inventory.map((item) => { const used = expenses.filter((expense) => expense.inventoryItemId === item.id && expense.date >= exportStart && expense.date <= exportEnd).reduce((sum, expense) => sum + expense.quantity, 0); return <tr key={item.id}><td>{item.name}</td><td>{item.category}</td><td>{item.initialQuantity ?? item.quantity}</td><td>{used}</td><td>{item.quantity}</td><td>{item.unit}</td></tr> })}</tbody></table></article></div>
}

function StockPrintReport({ businessName, inventory, stockMovements, currency, exportStart, exportEnd }: { businessName: string; inventory: InventoryItem[]; stockMovements: StockMovement[]; currency: string; exportStart: string; exportEnd: string }) {
  const printedAt = new Date()
  const periodMovements = stockMovements.filter((movement) => movement.date >= exportStart && movement.date <= exportEnd).sort((first, second) => `${first.date}T${first.time}`.localeCompare(`${second.date}T${second.time}`))
  const categories = Array.from(new Set([...inventory.map((item) => item.category), ...periodMovements.map((movement) => movement.category)])).filter(Boolean)
  const rows = categories.map((category) => { const items = inventory.filter((item) => item.category === category); const stocked = periodMovements.filter((movement) => movement.category === category && movement.type === 'Stocked').reduce((sum, movement) => sum + movement.quantity, 0); const used = periodMovements.filter((movement) => movement.category === category && movement.type === 'Used').reduce((sum, movement) => sum + movement.quantity, 0); return { category, stocked, used, remaining: items.reduce((sum, item) => sum + item.quantity, 0), unit: items[0]?.unit || periodMovements.find((movement) => movement.category === category)?.unit || 'units' } })
  return <div className="print-page unified-print-page"><article className="panel print-preview"><header className="payroll-print-header"><p className="eyebrow">BUSINESS REPORT</p><h1>{businessName}</h1><h2>Stock movement report</h2><p className="payroll-print-period">From {formatDate(exportStart)} to {formatDate(exportEnd)}<span>AS AT {formatDate(printedAt.toISOString())} {printedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span></p></header><h3 className="print-section-title">Complete stock movement by category</h3>{categories.length ? categories.map((category) => { const row = rows.find((item) => item.category === category)!; return <section className="stock-category-print" key={category}><h3>{category}</h3><table className="unified-report-table"><thead><tr><th>Date</th><th>Time</th><th>Type</th><th>Item</th><th>Quantity</th><th>Reason</th></tr></thead><tbody>{periodMovements.filter((movement) => movement.category === category).map((movement) => <tr key={movement.id}><td>{formatDate(movement.date)}</td><td>{movement.time}</td><td>{movement.type}</td><td>{movement.itemName}</td><td>{movement.quantity} {movement.unit}</td><td>{movement.reason}</td></tr>)}</tbody></table><table className="unified-report-table stock-category-total"><tbody><tr><th>Category total</th><td>Stocked: {row.stocked} {row.unit}</td><td>Used: {row.used} {row.unit}</td><td>Remaining: <strong>{row.remaining} {row.unit}</strong></td></tr></tbody></table></section> }) : <p className="empty-state">No stock movements in this period.</p>}</article></div>
}

function PayrollPrintReport({ businessName, members, attendance, deductions, currency, exportStart, exportEnd }: { businessName: string; members: Member[]; attendance: AttendanceEntry[]; deductions: Deduction[]; currency: string; exportStart: string; exportEnd: string }) {
  useEffect(() => {
    const period = document.querySelector('.payroll-print-header .payroll-print-period')
    if (!period) return
    period.textContent = `From ${formatDate(exportStart)} to ${formatDate(exportEnd)}`
    const asAt = document.createElement('span')
    asAt.textContent = `AS AT ${formatDate(new Date().toISOString())} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
    period.appendChild(asAt)
  }, [exportStart, exportEnd])
  const completedShifts = attendance.filter((entry) => entry.paymentStatus === 'Paid' && entry.checkOut !== '—' && entry.date >= exportStart && entry.date <= exportEnd)
  const payrollWorkers = members.map((member) => {
    const earnings = completedShifts.filter((entry) => entry.memberId === member.id)
    const workerDeductions = deductions.filter((deduction) => deduction.memberId === member.id && deduction.date >= exportStart && deduction.date <= exportEnd)
    const gross = earnings.length * member.payRate
    const deducted = workerDeductions.reduce((sum, deduction) => sum + deduction.amount, 0)
    return { member, earnings, deductions: workerDeductions, gross, deducted, net: Math.max(0, gross - deducted) }
  }).filter((worker) => worker.earnings.length > 0)
  const periodGross = payrollWorkers.reduce((sum, worker) => sum + worker.gross, 0)
  const periodDeductions = payrollWorkers.reduce((sum, worker) => sum + worker.deducted, 0)
  const periodNet = payrollWorkers.reduce((sum, worker) => sum + worker.net, 0)
  return <div className="print-page payroll-print-page"><article className="panel print-preview"><header className="payroll-print-header"><p className="eyebrow">BUSINESS REPORT</p><h1>{businessName}</h1><h2>Payroll report</h2><p className="payroll-print-period">From {exportStart} to {exportEnd}</p></header>{payrollWorkers.length ? payrollWorkers.map(({ member, earnings, deductions: workerDeductions, gross, deducted, net }) => <section className="payroll-worker-report" key={member.id}><h3>{member.name}</h3><p className="payroll-worker-meta">{member.department} · {member.payFrequency} pay · {currency} {member.payRate.toLocaleString()} per shift</p><table><thead><tr><th>Date</th><th>Type</th><th>Reason / details</th><th>Amount</th></tr></thead><tbody>{earnings.map((entry) => <tr key={`${member.id}-earning-${entry.date}`}><td>{entry.date}</td><td>Earning</td><td>Completed shift</td><td>{currency} {member.payRate.toLocaleString()}</td></tr>)}{workerDeductions.map((deduction) => <tr className="payroll-deduction-row" key={`deduction-${deduction.id}`}><td>{deduction.date}</td><td>Deduction</td><td>{deduction.reason}</td><td>- {currency} {deduction.amount.toLocaleString()}</td></tr>)}<tr className="payroll-total-row"><td colSpan={3}>Gross earnings</td><td>{currency} {gross.toLocaleString()}</td></tr><tr className="payroll-total-row"><td colSpan={3}>Total deductions</td><td>- {currency} {deducted.toLocaleString()}</td></tr><tr className="payroll-net-row"><td colSpan={3}>Net pay</td><td>{currency} {net.toLocaleString()}</td></tr></tbody></table></section>) : <p className="empty-state">No earnings or deductions in this period.</p>}<section className="payroll-period-summary"><h3>Payroll period totals</h3><table><tbody><tr><th>Total earnings</th><td>{currency} {periodGross.toLocaleString()}</td></tr><tr><th>Total deductions</th><td>- {currency} {periodDeductions.toLocaleString()}</td></tr><tr className="payroll-net-row"><th>Total amount payable to workers</th><td>{currency} {periodNet.toLocaleString()}</td></tr></tbody></table></section></article></div>
}

function AccountChoiceModal({ onClose, onExisting, onCreate }: { onClose: () => void; onExisting: () => void; onCreate: () => void }) { return <div className="account-choice-backdrop" role="dialog" aria-modal="true"><section className="account-choice-modal"><button className="choice-close" aria-label="Close" onClick={onClose}>×</button><p className="eyebrow">ADD ACCOUNT</p><h2>Choose how to continue</h2><p>Select an existing team member or create a new account.</p><div className="account-choice-actions"><button className="choice-card" onClick={onExisting}><strong>Existing member</strong><span>Choose one member from Team and assign access.</span><b>→</b></button><button className="choice-card choice-card-accent" onClick={onCreate}><strong>Create new account</strong><span>Open the member form and create a login account.</span><b>→</b></button></div></section></div> }

function PermissionsPage({ members, accessByMember, setAccessByMember, selectedMemberId, onAddMember, onSave, onSetCredentials, onCancel }: { members: Member[]; accessByMember: Record<number, AccessArea[]>; setAccessByMember: (value: Record<number, AccessArea[]>) => void; selectedMemberId?: number | null; onAddMember: () => void; onSave: (member: Member, grantedPages: AccessArea[]) => void; onSetCredentials: (memberId: number, username: string, password: string) => Promise<Member>; onCancel: () => void }) {
  const accountMembers = members;
  const [selectedId, setSelectedId] = useState(selectedMemberId || accountMembers[0]?.id || 0)
  const selected = accountMembers.find((member) => member.id === selectedId)
  const [draftAccess, setDraftAccess] = useState<AccessArea[]>([])
  const [credentialsOpen, setCredentialsOpen] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [credentialError, setCredentialError] = useState('')
  const granted = draftAccess
  useEffect(() => { if (selectedMemberId) setSelectedId(selectedMemberId) }, [selectedMemberId])
  useEffect(() => { setDraftAccess(selected ? accessByMember[selected.id] || [] : []) }, [selectedId, accessByMember])
  useEffect(() => {
    const container = document.querySelector('.permission-confirm')
    if (!container || container.querySelector('.permission-cancel')) return
    const cancel = document.createElement('button')
    cancel.type = 'button'
    cancel.className = 'secondary-button permission-cancel'
    cancel.textContent = 'Cancel'
    cancel.addEventListener('click', onCancel)
    container.prepend(cancel)
    return () => cancel.remove()
  }, [selectedId, onCancel])
  const toggle = (area: AccessArea) => setDraftAccess((current) => current.includes(area) ? current.filter((item) => item !== area) : [...current, area])
  const saveAccess = (member: Member) => { setAccessByMember({ ...accessByMember, [member.id]: draftAccess }); onSave(member, draftAccess) }
  const confirmAccess = () => {
    if (!selected) return
    if (!selected.username || !selected.password) {
      setUsername(selected.username || '')
      setPassword('')
      setCredentialError('')
      setCredentialsOpen(true)
      return
    }
    saveAccess(selected)
  }
  const submitCredentials = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selected) return
    const nextUsername = username.trim().toLowerCase()
    if (nextUsername.length < 3) { setCredentialError('Username must be at least 3 characters.'); return }
    if (password.length < 6) { setCredentialError('Password must be at least 6 characters.'); return }
    const updateCredentials = onSetCredentials || (window as any).__biztrackSetMemberCredentials
    if (!updateCredentials) { setCredentialError('Unable to save login details.'); return }
    const updatedMember = await updateCredentials(selected.id, nextUsername, password)
    setCredentialsOpen(false)
    saveAccess(updatedMember)
  }
  return <><PageHeading eyebrow="OWNER CONTROL / PERMISSIONS" title="Permissions" subtitle="Choose which parts of Biz Track each account holder can access." action={<button className="primary-button" onClick={onAddMember}>＋ Add account</button>} /><div className="permissions-layout"><article className="panel permissions-people"><PanelHeading title="Account holders" subtitle="Only members with login accounts appear here." />{accountMembers.length ? accountMembers.map((member) => <button key={member.id} className={`permission-person ${selectedId === member.id ? 'selected' : ''}`} onClick={() => setSelectedId(member.id)}><span className={`avatar avatar-${member.color}`}>{member.initials}</span><span><strong>{member.name}</strong><small>{member.role} · {member.department}</small></span><b>→</b></button>) : <div className="permission-empty"><strong>No account holders yet</strong><p>Enable a login account when adding a member, then return here to set their access.</p><button className="secondary-button" onClick={onAddMember}>Add account holder</button></div>}</article><article className="panel permission-editor"><PanelHeading title={selected ? `Access for ${selected.name}` : 'Choose an account'} subtitle="Select the pages this account holder can access, then confirm." />{selected ? <><div className="permission-grid">{accessAreas.map((area) => <label key={area} className={`permission-toggle ${granted.includes(area) ? 'enabled' : ''}`}><input type="checkbox" checked={granted.includes(area)} onChange={() => toggle(area)} /><span><strong>{area}</strong><small>{area === 'Overview' ? 'Business summary and daily activity' : `Open and work with ${area.toLowerCase()} records`}</small></span><i>{granted.includes(area) ? 'On' : 'Off'}</i></label>)}</div><div className="permission-confirm"><button className="primary-button" onClick={confirmAccess}>OK</button></div></> : <div className="permission-empty"><strong>Choose an account to begin</strong><p>Your access controls will appear here after you select a member with a login account.</p></div>}</article></div>{credentialsOpen && selected && <div className="admin-modal-backdrop" role="presentation"><section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="member-credentials-title"><button className="admin-modal-close" type="button" aria-label="Close" onClick={() => setCredentialsOpen(false)}>×</button><p className="eyebrow">MEMBER LOGIN</p><h2 id="member-credentials-title">Set login details</h2><p className="admin-modal-user"><strong>{selected.name}</strong><span>Create credentials so this member can sign in and use the pages you selected.</span></p><form onSubmit={submitCredentials}><label className="login-field"><span>Username</span><input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required /></label><label className="login-field"><span>Password</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={6} required /></label>{credentialError && <p className="login-error" role="alert">{credentialError}</p>}<div className="form-actions"><button type="button" className="secondary-button" onClick={() => setCredentialsOpen(false)}>Cancel</button><button type="submit" className="primary-button">Save login</button></div></form></section></div>}</>
}

function WorkspaceSidebar({ businessName, activeNav, onNavigate, onLogout }: { businessName: string; activeNav: string; onNavigate: (page: string) => void; onLogout: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const allowedPages = ((window as any).__biztrackVisibleWorkspacePages || uniqueAccessAreas) as AccessArea[]
  const canSee = (link: string) => allowedPages.includes(link as AccessArea)
  const iconFor = (link: string) => navItems.find((item) => item.label === link)?.icon || (link === 'Permissions' ? '⌘' : link === 'OFF MARK' ? '◉' : link === 'Team' ? '◎' : link === 'Add member' ? '+' : link === 'Settings' ? '⚙' : link === 'ROLL' ? '◷' : '◈')
  const navigateFromSidebar = (page: string) => { setExpanded(false); onNavigate(page) }
  const openHelp = () => {
    const url = whatsappHelpUrl(businessName, (window as any).__biztrackHelpOwner || null, (window as any).__biztrackHelpMembers || [], (window as any).__biztrackHelpSessionMemberId ?? 0, (window as any).__biztrackWhatsappNumber || readStoredWhatsappNumber())
    if (!url) { window.alert('Help center WhatsApp number is not configured.'); return }
    const link = document.createElement('a')
    link.href = url
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    link.click()
  }
  return <><button className="sidebar-toggle" aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'} aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}><span>{expanded ? '‹' : '☰'}</span><b>{expanded ? 'Collapse menu' : 'Menu'}</b></button><aside className={`sidebar ${expanded ? 'sidebar-expanded' : ''}`}><div className="business-sidebar-name" aria-label="Business name"><span>{businessName}</span></div><nav aria-label="Workspace navigation">{sidebarGroups.map((group) => { const visibleLinks = group.links.filter(canSee); return visibleLinks.length ? <section className={`sidebar-group ${group.label ? '' : 'sidebar-group-primary'}`} key={group.label || 'primary'}>{group.label && <p className="nav-label">{group.label}</p>}{visibleLinks.map((link) => <button key={link} className={`nav-item ${activeNav === link ? 'active' : ''}`} onClick={() => navigateFromSidebar(link)}><span className="nav-icon">{iconFor(link)}</span>{visiblePageName(link)}</button>)}</section> : null })}</nav><div className="sidebar-footer"><button className="help-link" type="button" onClick={openHelp}><span className="help-mark">?</span><span>Help center</span></button><button className="sidebar-signout" onClick={onLogout}>↪ Sign out</button></div></aside></>
}

function TermsPage({ onNavigate }: { onNavigate: (page: string) => void }) {
  const sections = [{ title: '1. Introduction', body: 'Welcome to BizTrack (the App). These Terms and Conditions govern your use of BizTrack, which provides business record-keeping, workspace management, package registration, and user access controls. By registering a business account or using the App, you agree to these Terms.' }, { title: '2. Definitions', body: 'Business Owner means the person or organization that registers a business workspace. User means a person invited by the Business Owner with account credentials. Credentials means a username and password. Pages or Modules means the App sections assigned to a User. Data means information entered, stored, or processed in the workspace.' }, { title: '3. Account Registration', body: 'Business Owners must provide accurate and complete registration information, choose an available package, and keep account information current. Business Owners are responsible for registering Users, creating their credentials, and assigning appropriate page access. Users must keep their Credentials confidential and must not share them.' }, { title: '4. User Access and Responsibilities', body: 'Users may access only the Pages or Modules assigned by the Business Owner. Attempts to bypass access restrictions, use another person’s Credentials, or access a workspace without authorization are prohibited. Users and Business Owners must enter accurate, lawful, and appropriate Data.' }, { title: '5. Data Management', body: 'Workspace Data is associated with the Business Owner’s workspace and may include team, attendance, sales, payroll, inventory, settings, and access-control records. The Business Owner is responsible for the accuracy, legality, integrity, and appropriate retention of that Data. BizTrack provides structured record-keeping and does not guarantee compliance with external legal, tax, employment, or financial requirements.' }, { title: '6. Security', body: 'Business Owners choose or issue User Credentials through the App and must use reasonable care when creating and managing them. Users must keep passwords confidential, use strong passwords, and report suspected unauthorized access promptly. BizTrack uses reasonable technical measures, but no online system can be guaranteed completely secure.' }, { title: '7. Privacy', body: 'BizTrack does not sell workspace Data. Data may be processed by service providers needed to operate the App, including hosting and database providers, or disclosed where required by law. Business Owners are responsible for informing their Users about the Data they enter and how the workspace is managed.' }, { title: '8. Package and Service Changes', body: 'Package names, prices, durations, included features, seat limits, and availability are set by the site administrator and may change for future registrations. Existing workspace records remain associated with their workspace, subject to the service configuration and applicable law.' }, { title: '9. Limitations of Liability', body: 'The App is provided as available and without warranties to the extent permitted by law. BizTrack is not responsible for losses caused by inaccurate Data, unauthorized disclosure of Credentials, misuse of the App, service interruptions, or decisions made solely from records stored in the App. Business Owners remain responsible for their business decisions and compliance obligations.' }, { title: '10. Termination', body: 'A Business Owner may stop using a workspace subject to any applicable package or service arrangements. BizTrack may suspend or terminate access for misuse, unauthorized access, security risks, non-payment, or violation of these Terms. Access restrictions do not remove the Business Owner’s responsibility for lawful handling of Data.' }, { title: '11. Amendments', body: 'These Terms may be updated when the App, packages, or applicable requirements change. The updated version will be published in the App. Continued use after publication means you accept the updated Terms.' }, { title: '12. Governing Law', body: 'These Terms are governed by the applicable laws of the jurisdiction in which BizTrack is operated, unless a written agreement states otherwise. Contact BizTrack support for questions about these Terms.' }]
  return <main className="terms-page"><header className="register-header"><button className="welcome-brand" onClick={() => onNavigate('Welcome')}><span className="welcome-mark">b</span><span>biz track</span></button><button className="register-back" onClick={() => onNavigate('Welcome')}>Back to welcome</button></header><article className="terms-card"><p className="welcome-kicker">BIZTRACK / LEGAL</p><h1>Terms and Conditions</h1><p className="terms-intro">Last updated: September 19, 2026</p>{sections.map((section) => <section key={section.title}><h2>{section.title}</h2><p>{section.body}</p></section>)}<div className="terms-actions"><button className="secondary-button" onClick={() => onNavigate('Welcome')}>Return to welcome</button><button className="primary-button" onClick={() => onNavigate('Register')}>Create an account <span>→</span></button></div></article></main>
}

function WelcomePage({ onNavigate, hasOwnerAccount, businessName }: { onNavigate: (page: string) => void; hasOwnerAccount: boolean; businessName?: string }) {
  useEffect(() => {
    const termsLink = document.querySelector('.welcome-footer a[href*="subject=Terms"]') as HTMLAnchorElement | null
    if (!termsLink) return
    const openTerms = (event: MouseEvent) => { event.preventDefault(); onNavigate('Terms') }
    termsLink.addEventListener('click', openTerms)
    return () => termsLink.removeEventListener('click', openTerms)
  }, [onNavigate])
  return <div className="welcome-page">
    <header className="welcome-nav"><button className="welcome-brand" onClick={() => onNavigate('Welcome')}><span className="welcome-mark">b</span><span>biz track</span></button><nav><button className="welcome-link" onClick={() => document.querySelector('.welcome-model')?.scrollIntoView({ behavior: 'smooth' })}>How it works</button><button className="welcome-link" onClick={() => document.querySelector('.welcome-model')?.scrollIntoView({ behavior: 'smooth' })}>Features</button><button className="welcome-link" onClick={() => onNavigate('Sign in')}>Sign in</button><button className="welcome-nav-cta" onClick={() => onNavigate('Register')}>Create account <span>↗</span></button></nav></header>
    <main>
      <section className="welcome-hero"><div className="welcome-hero-copy"><p className="welcome-kicker">THE BUSINESS OPERATING DESK</p><h1>Start the day<br /><em>with clarity.</em></h1><p className="welcome-lead">Biz Track brings your people, sales, stock, attendance, and payroll into one calm place to run the business.</p><div className="welcome-actions"><button className="welcome-primary" onClick={() => onNavigate(hasOwnerAccount ? 'Sign in' : 'Register')}>{hasOwnerAccount ? 'Sign in to Biz Track' : 'Attend Tracker'} <span>→</span></button></div><div className="welcome-proof"><span className="proof-avatars"><i>AN</i><i>JO</i><i>SK</i><b>+</b></span><span>One workspace for<br /><strong>the whole team</strong></span></div></div><div className="welcome-hero-art"><div className="hero-orbit hero-orbit-a"></div><div className="hero-orbit hero-orbit-b"></div><div className="hero-sticker"><span>BUILT FOR<br />BUSY DAYS</span><b>✦</b></div><div className="welcome-board"><div className="board-top"><span><i></i> {businessName || 'Your workspace'}</span><small>Today · 09:41</small></div><div className="board-heading"><div><small>GOOD MORNING</small><strong>Today at a glance</strong></div><span>•••</span></div><div className="board-metrics"><div><small>Sales today</small><strong>KES 284.5k</strong><b>↑ 12.8%</b></div><div><small>Team present</small><strong>18 / 21</strong><b className="board-warm">85.7%</b></div></div><div className="board-chart"><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div><div className="board-footer"><span><i className="board-green"></i>Team activity</span><span><i className="board-coral"></i>Sales</span><strong>View dashboard →</strong></div></div><div className="hero-float hero-float-one"><b>18</b><span>people in<br />today</span><i>✓</i></div><div className="hero-float hero-float-two"><b>03</b><span>stock alerts<br />to check</span></div></div></section>
      <section className="welcome-model"><div><p className="welcome-kicker">A SIMPLE MODEL</p><h2>One owner.<br /><em>A stronger team.</em></h2></div><div className="welcome-model-copy"><p>The business owner creates the workspace, then invites the people who keep it moving. Give each person the right role, department, and access so everyone knows what to do next.</p><div className="welcome-steps"><article><b>01</b><strong>Create your workspace</strong><span>Set up the business owner account and start with a clear home base.</span></article><article><b>02</b><strong>Add your people</strong><span>Create subaccounts for managers, cashiers, stock keepers, and workers.</span></article><article><b>03</b><strong>Assign the work</strong><span>Organize departments and control which parts of Biz Track each person can use.</span></article></div></div></section>
      <section className="welcome-bottom"><p>READY WHEN YOU ARE</p><h2>Run a better business<br />from the first shift.</h2><button onClick={() => onNavigate(hasOwnerAccount ? 'Sign in' : 'Register')}>{hasOwnerAccount ? 'Enter your workspace' : 'Attend Tracker'} <span>↗</span></button></section>
    </main><footer className="welcome-footer"><div className="welcome-footer-brand"><span className="welcome-mark">b</span><strong>biz track</strong><p>People · Performance · Progress</p></div><div className="welcome-footer-group"><strong>Product</strong><button onClick={() => document.querySelector('.welcome-model')?.scrollIntoView({ behavior: 'smooth' })}>How it works</button><button onClick={() => document.querySelector('.welcome-model')?.scrollIntoView({ behavior: 'smooth' })}>Features</button><button onClick={() => document.querySelector('.welcome-bottom')?.scrollIntoView({ behavior: 'smooth' })}>Pricing</button></div><div className="welcome-footer-group"><strong>Account</strong><button onClick={() => onNavigate('Sign in')}>Sign in</button><button onClick={() => onNavigate('Register')}>Attend Tracker</button><button onClick={() => onNavigate(hasOwnerAccount ? 'Sign in' : 'Register')}>Open workspace</button></div><div className="welcome-footer-group"><strong>Resources</strong><a href="mailto:support@biztrack.app?subject=Biz Track FAQ">FAQs</a><a href="mailto:support@biztrack.app?subject=Terms and conditions">Terms and conditions</a><a href="mailto:support@biztrack.app?subject=Privacy policy">Privacy policy</a></div><div className="welcome-footer-group"><strong>Contact</strong><a href="mailto:support@biztrack.app">support@biztrack.app</a><a href="tel:+254700000000">+254 700 000 000</a><span>Mon–Fri, 8:00–17:00</span></div><div className="welcome-footer-bottom"><span>© 2026 Biz Track. All rights reserved.</span><span>Built for businesses that keep moving.</span></div></footer>
  </div>
}

function LegacyLoginPage({ members, accessByMember, setAccessByMember, onLogin }: { members: Member[]; accessByMember: Record<number, AccessArea[]>; setAccessByMember: (value: Record<number, AccessArea[]>) => void; onLogin: (memberId: number) => void }) {
  const [selectedMemberId, setSelectedMemberId] = useState(members[0]?.id || 0)
  const selectedMember = members.find((member) => member.id === selectedMemberId)
  const selectedAccess = accessByMember[selectedMemberId] || []
  const toggleAccess = (area: AccessArea) => setAccessByMember({ ...accessByMember, [selectedMemberId]: selectedAccess.includes(area) ? selectedAccess.filter((item) => item !== area) : [...selectedAccess, area] })
  return <div className="login-shell"><div className="login-card"><div className="brand login-brand"><span className="brand-mark">b</span><span>biz track</span></div><p className="eyebrow">WORKSPACE ACCESS</p><h1>Sign in to your workspace</h1><p className="subheading">Choose your registered worker ID to continue.</p><label className="login-field"><span>Worker ID</span><select value={selectedMemberId} onChange={(event) => setSelectedMemberId(Number(event.target.value))}>{members.map((member) => <option key={member.id} value={member.id}>ID {member.id} · {member.name}</option>)}</select></label><button className="primary-button login-button" onClick={() => selectedMember && onLogin(selectedMember.id)}>Continue</button>{selectedMember && <section className="access-editor"><div><p className="eyebrow">OWNER ACCESS CONTROL</p><h2>Areas for {selectedMember.name}</h2><p>Choose the pages this registered user can open.</p></div><div className="access-grid">{accessAreas.map((area) => <label key={area} className="access-option"><input type="checkbox" checked={selectedAccess.includes(area)} onChange={() => toggleAccess(area)} /><span>{area}</span></label>)}</div></section>}</div></div>
}

function LoginPage({ ownerAccount, setOwnerAccount, members, accessByMember, setAccessByMember, onLogin }: { ownerAccount: OwnerAccount | null; setOwnerAccount: (value: OwnerAccount) => void; members: Member[]; accessByMember: Record<number, AccessArea[]>; setAccessByMember: (value: Record<number, AccessArea[]>) => void; onLogin: (memberId: number) => void }) { const [name, setName] = useState(''); const [username, setUsername] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const isSetup = !ownerAccount; const selectedMember = members.find((member) => member.username.toLowerCase() === username.trim().toLowerCase()); const selectedAccess = selectedMember ? accessByMember[selectedMember.id] || [] : []; const toggleAccess = (area: AccessArea) => { if (!selectedMember) return; setAccessByMember({ ...accessByMember, [selectedMember.id]: selectedAccess.includes(area) ? selectedAccess.filter((item) => item !== area) : [...selectedAccess, area] }) }; const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (isSetup) { if (!name.trim() || username.trim().length < 3 || password.length < 6) { setError('Enter an owner name, a username of at least 3 characters, and a password of at least 6 characters.'); return } setOwnerAccount({ name: name.trim(), username: username.trim(), password }); onLogin(-1); return } const ownerMatch = ownerAccount.username.toLowerCase() === username.trim().toLowerCase() && ownerAccount.password === password; const member = members.find((item) => item.username.toLowerCase() === username.trim().toLowerCase() && item.password === password); if (!ownerMatch && !member) { setError('Invalid username or password.'); return } setError(''); onLogin(ownerMatch ? -1 : member.id) }; return <div className="login-shell"><form className="login-card" onSubmit={submit}><div className="brand login-brand"><span className="brand-mark">f</span><span>fielddesk</span></div><p className="eyebrow">NORTHSTAR CAFE WORKSPACE</p><h1>{isSetup ? 'Create the business owner' : 'Sign in to your workspace'}</h1><p className="subheading">{isSetup ? 'The owner account controls this workspace and creates all registered users.' : 'Use your registered username and password to continue.'}</p>{isSetup && <label className="login-field"><span>Owner name</span><input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required /></label>}<label className="login-field"><span>Username</span><input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required /></label><label className="login-field"><span>Password</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={isSetup ? 'new-password' : 'current-password'} required /></label>{error && <p className="login-error" role="alert">{error}</p>}<button className="primary-button login-button" type="submit">{isSetup ? 'Create owner account' : 'Sign in'}</button>{!isSetup && <section className="access-editor"><p className="eyebrow">OWNER ACCESS CONTROL</p><h2>{selectedMember ? `Areas for ${selectedMember.name}` : 'Registered users'}</h2><p>{selectedMember ? 'Choose the pages this worker can open.' : 'Sign in as the owner to manage user access.'}</p>{selectedMember && <div className="access-grid">{accessAreas.map((area) => <label key={area} className="access-option"><input type="checkbox" checked={selectedAccess.includes(area)} onChange={() => toggleAccess(area)} /><span>{area}</span></label>)}</div>}</section>}</form></div> }

function SignInPage({ ownerAccount, members, siteAdminAccount, onLogin, onAdminLogin, onNavigate }: { ownerAccount: OwnerAccount | null; members: Member[]; siteAdminAccount?: OwnerAccount | null; onLogin: (memberId: number) => void; onAdminLogin?: (success: boolean) => void; onNavigate?: (page: string) => void }) { const [username, setUsername] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const normalizedUser = username.trim().toLowerCase(); const adminMatch = siteAdminAccount && normalizedUser === siteAdminAccount.username.toLowerCase() && password === siteAdminAccount.password; if (adminMatch) { setError(''); onAdminLogin?.(true); return } const ownerMatch = ownerAccount && ownerAccount.username.toLowerCase() === normalizedUser && ownerAccount.password === password; const member = members.find((item) => item.username.toLowerCase() === normalizedUser && item.password === password); if (!ownerMatch && !member) { setError(ownerAccount ? 'Invalid username or password.' : 'Create an account before signing in.'); return } setError(''); onLogin(ownerMatch ? -1 : member!.id) }; return <main className="auth-page"><div className="auth-decoration auth-decoration-one"></div><div className="auth-decoration auth-decoration-two"></div><form className="login-card minimal-login" onSubmit={submit}><div className="auth-brand"><span className="auth-brand-mark">b</span><strong>biz track</strong></div><h1>Welcome back</h1><p className="auth-copy">Use your username and password to sign in. The site admin account also works here.</p><label className="login-field"><span>Username</span><input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" placeholder="admin or owner username" required /></label><label className="login-field"><span>Password</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" placeholder="••••••••" required /></label>{error && <p className="login-error" role="alert">{error}</p>}<div className="form-actions"><button type="button" className="secondary-button" onClick={() => onNavigate ? onNavigate('Register') : window.history.pushState({}, '', '/register/')}>Create account</button><button className="primary-button login-button" type="submit">Sign in <span>→</span></button></div></form></main> }

function SiteAdminRegisterPage({ onRegister, onBack }: { onRegister: (account: OwnerAccount) => void; onBack: () => void }) {
  const [error, setError] = useState('')
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const name = String(form.get('name') || '').trim()
    const username = String(form.get('username') || '').trim()
    const password = String(form.get('password') || '')
    const confirmation = String(form.get('confirmation') || '')
    if (name.length < 2 || username.length < 3) { setError('Enter a name and a username of at least 3 characters.'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (password !== confirmation) { setError('Passwords do not match.'); return }
    onRegister({ name, username, password, business: 'Biz Track HQ' })
  }
  return <main className="auth-page"><div className="auth-decoration auth-decoration-one"></div><div className="auth-decoration auth-decoration-two"></div><form className="login-card minimal-login" onSubmit={submit}><div className="auth-brand"><span className="auth-brand-mark">b</span><strong>biz track</strong></div><h1>Create site admin</h1><p className="auth-copy">Set up the account used to manage businesses, registrations, and platform settings.</p><label className="login-field"><span>Full name</span><input name="name" autoComplete="name" placeholder="Your full name" required /></label><label className="login-field"><span>Username</span><input name="username" autoComplete="username" placeholder="Choose a username" required /></label><label className="login-field"><span>Password</span><input name="password" type="password" autoComplete="new-password" placeholder="At least 6 characters" required /></label><label className="login-field"><span>Confirm password</span><input name="confirmation" type="password" autoComplete="new-password" placeholder="Repeat your password" required /></label>{error && <p className="login-error" role="alert">{error}</p>}<div className="form-actions"><button type="button" className="secondary-button" onClick={onBack}>Back</button><button className="primary-button login-button" type="submit">Create account <span>→</span></button></div></form></main>
}

function AdminSignInPage(props: any) { return <><SignInPage {...props} /><button className="admin-register-link" type="button" onClick={() => props.onNavigate('Register site admin')}>Register a site admin account</button></> }

function AccessDeniedPage({ onBack }: { onBack: () => void }) { return <div className="access-denied"><div className="panel"><p className="eyebrow">ACCESS RESTRICTED</p><h1>This area is not assigned to your account.</h1><p className="subheading">Ask the owner to enable this page in access control.</p><button className="primary-button" onClick={onBack}>Return to overview</button></div></div> }
function SubscriptionRequiredPage({ expired, onSignOut }: { expired: boolean; onSignOut: () => void }) { return <div className="access-denied"><div className="panel"><p className="eyebrow">PACKAGE ACCESS</p><h1>{expired ? 'This package has expired.' : 'This business is awaiting activation.'}</h1><p className="subheading">{expired ? 'Ask the site admin to reactivate the package.' : 'The site admin must activate this selected package before the workspace can be used.'}</p><button className="primary-button" onClick={onSignOut}>Sign out</button></div></div> }

function EnhancedSettingsPage({ members, defaultSignIn, defaultSignOut, strictSignIn, setStrictSignIn, categories, setCategories, setDefaultSignIn, setDefaultSignOut, setMembers, onChange }: { members: Member[]; defaultSignIn: string; defaultSignOut: string; strictSignIn: boolean; setStrictSignIn: (value: boolean) => void; categories: string[]; setCategories: (value: string[]) => void; setDefaultSignIn: (value: string) => void; setDefaultSignOut: (value: string) => void; setMembers: (members: Member[]) => void; onChange: () => void }) { const [businessName, setBusinessName] = useState('Northstar Cafe'); const [payrollTime, setPayrollTime] = useState('17:00'); const saveBusinessName = (value: string) => { setBusinessName(value); onChange() }; const savePayrollTime = (value: string) => { setPayrollTime(value); onChange() }; return <><PageHeading eyebrow="WORKSPACE / SETTINGS" title="Settings" subtitle="The owner controls workspace identity, payroll, attendance, inventory, and user accounts." /><section className="settings-stack"><article className="panel member-form"><PanelHeading title="Business workspace" subtitle="These details are used across the workspace." /><div className="form-grid"><label><span>Business name</span><input value={businessName} onChange={(event) => saveBusinessName(event.target.value)} /></label><label><span>Payroll payment time</span><input type="time" value={payrollTime} onChange={(event) => savePayrollTime(event.target.value)} /></label></div></article><article className="panel member-form"><PanelHeading title="Attendance and store rules" subtitle="Set defaults used when creating accounts and recording stock." /><div className="form-grid settings-times"><label><span>Default sign-in time</span><input type="time" value={defaultSignIn} onChange={(event) => { setDefaultSignIn(event.target.value); onChange() }} /></label><label><span>Default sign-out time</span><input type="time" value={defaultSignOut} onChange={(event) => { setDefaultSignOut(event.target.value); onChange() }} /></label><label><span>Strict sign-in checks</span><input type="checkbox" checked={strictSignIn} onChange={(event) => { setStrictSignIn(event.target.checked); onChange() }} /></label><label><span>Store categories</span><input value={categories.join(', ')} onChange={(event) => { const next = event.target.value.split(',').map((item) => item.trim()).filter(Boolean); setCategories(next.length ? next : categories); onChange() }} /></label></div></article><article className="panel team-panel"><PanelHeading title="Create and manage accounts" subtitle="Use Add member to create usernames, passwords, roles, and schedules." action={<a className="primary-button" href={pagePaths['Add member']}>＋ Add account</a>} /><SettingsPage members={members} defaultSignIn={defaultSignIn} defaultSignOut={defaultSignOut} strictSignIn={strictSignIn} setStrictSignIn={setStrictSignIn} categories={categories} setCategories={setCategories} setDefaultSignIn={setDefaultSignIn} setDefaultSignOut={setDefaultSignOut} setMembers={setMembers} onChange={onChange} /></article></section></> }

function BulkAttendancePage({ action, members, entries, allowMultipleDailyShifts = false, onMarkAttendance, onMarkSignOut, onSuccess }: { action: 'Sign in' | 'Sign out'; members: Member[]; entries: AttendanceEntry[]; allowMultipleDailyShifts?: boolean; onMarkAttendance: (memberId: number, status: 'Present' | 'Absent') => boolean | void | Promise<boolean | void>; onMarkSignOut: (memberId: number) => boolean | Promise<boolean>; onSuccess: (count: number) => void }) {
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const departments = Array.from(new Set(members.map((member) => member.department)))
  const eligibleFor = (department: string) => members.filter((member) => member.department === department).filter((member) => {
    const entry = entries.find((item) => item.memberId === member.id && item.date === today)
    if (action === 'Sign in') {
      if (entry?.status === 'Off') return false
      return !entry || entry.status === 'Absent'
    }
    return (entry?.status === 'Present' || entry?.status === 'Late') && entry.checkOut === '—'
  })
  const toggle = (id: number) => setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  const toggleDepartment = (department: string) => { const ids = eligibleFor(department).map((member) => member.id); setSelectedIds((current) => ids.every((id) => current.includes(id)) ? current.filter((id) => !ids.includes(id)) : Array.from(new Set([...current, ...ids]))) }
  const submit = async () => { (window as any).__bulkAttendanceInProgress = true; const results = await Promise.all(selectedIds.map((id) => action === 'Sign in' ? onMarkAttendance(id, 'Present') : onMarkSignOut(id))); const successful = results.filter((result) => result !== false).length; (window as any).__bulkAttendanceInProgress = false; if (successful) { onSuccess(successful); (window as any).__attendanceSuccess?.(`${successful} worker${successful === 1 ? '' : 's'} signed ${action === 'Sign in' ? 'in' : 'out'} successfully`) } }
  return <><PageHeading eyebrow={`PEOPLE / BULK ${action.toUpperCase()}`} title={`Bulk worker ${action.toLowerCase()}`} subtitle={`Choose departments and their eligible members, then ${action.toLowerCase()} everyone selected in one action.`} /><article className="panel member-form bulk-attendance-panel"><PanelHeading title={`Department roster`} subtitle={`${selectedIds.length} worker${selectedIds.length === 1 ? '' : 's'} selected for this bulk action.`} /><div className="bulk-department-list">{departments.map((department) => { const eligible = eligibleFor(department); const selectedCount = eligible.filter((member) => selectedIds.includes(member.id)).length; return <section className="bulk-department-section" key={department}><header><div><span className="bulk-department-icon">▦</span><span><strong>{department}</strong><small>{eligible.length} eligible member{eligible.length === 1 ? '' : 's'}</small></span></div><button type="button" className="bulk-select-all" disabled={!eligible.length} onClick={() => toggleDepartment(department)}>{selectedCount === eligible.length && eligible.length ? 'Clear department' : 'Select department'}</button></header>{eligible.length ? <div className="bulk-worker-list">{eligible.map((member) => <label className={`bulk-worker ${selectedIds.includes(member.id) ? 'selected' : ''}`} key={member.id}><input type="checkbox" checked={selectedIds.includes(member.id)} onChange={() => toggle(member.id)} /><span className={`avatar avatar-${member.color}`}>{member.initials}</span><span><strong>{member.name}</strong><small>{member.role} · ID {member.id}</small></span><b>{selectedIds.includes(member.id) ? 'Selected' : 'Choose'}</b></label>)}</div> : <p className="bulk-empty">No eligible workers in this department today.</p>}</section> })}</div><div className="form-actions"><button className="secondary-button" onClick={() => window.history.back()}>Back</button><button className="primary-button" disabled={!selectedIds.length} onClick={submit}>{action === 'Sign in' ? 'Sign in selected' : 'Sign out selected'} <span>→</span></button></div></article></>
}

function CurrentWorkerSignInPage({ members, entries, strictSignIn, defaultSignIn, allowMultipleDailyShifts, onAttendance, onMarkAttendance, onSuccess }: { members: Member[]; entries: AttendanceEntry[]; strictSignIn: boolean; defaultSignIn: string; allowMultipleDailyShifts: boolean; onAttendance: () => void; onMarkAttendance: (memberId: number, status: 'Present' | 'Absent') => boolean | void | Promise<boolean | void>; onSuccess?: (count: number) => void }) {
  const [selectedMemberId, setSelectedMemberId] = useState<number | ''>('')
  if (new URLSearchParams(window.location.search).get('mode') === 'bulk') return <BulkAttendancePage action="Sign in" members={members} entries={entries} allowMultipleDailyShifts={allowMultipleDailyShifts} onMarkAttendance={onMarkAttendance} onMarkSignOut={() => false} onSuccess={(count) => { onSuccess?.(count); (window as any).__attendanceSuccess?.(`${count} worker${count === 1 ? '' : 's'} signed in successfully`) }} />
  const selectedMember = members.find((member) => member.id === selectedMemberId)
  const selectedEntry = selectedMember ? entries.find((entry) => entry.memberId === selectedMember.id && entry.date === today) : undefined
  const isUnavailable = selectedEntry?.status === 'Off' || selectedEntry?.status === 'Present' || selectedEntry?.status === 'Late'
  const submit = async (status: 'Present' | 'Absent') => {
    if (!selectedMember || (status === 'Present' && isUnavailable)) return
    const success = await onMarkAttendance(selectedMember.id, status)
    if (status === 'Present' && success !== false) onSuccess?.(1)
  }
  return <><PageHeading eyebrow="PEOPLE / ROLL" title="Sign in a worker" subtitle={strictSignIn ? 'Strict sign-in checks are enabled for hourly staff.' : 'Record the start of a worker\'s shift.'} /><article className="panel member-form worker-attendance-form sign-in-panel"><PanelHeading title="Choose a worker" subtitle="Select a team member to record today’s attendance." /><div className="form-grid single-field"><label><span>Worker</span><select value={selectedMemberId} onChange={(event) => setSelectedMemberId(Number(event.target.value) || '')}><option value="">Select worker (ID)</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name} (ID: {member.id})</option>)}</select></label></div>{selectedMember && <div className="sign-in-summary"><div><span>Scheduled sign-in</span><strong>{selectedMember.signInTime || defaultSignIn}</strong></div><div><span>Today’s status</span><strong>{selectedEntry?.status || 'Not recorded'}</strong></div></div>}<div className="form-actions"><button type="button" className="secondary-button" disabled={!selectedMember || isUnavailable} onClick={() => submit('Absent')}>Mark absent</button><button type="button" className="primary-button" disabled={!selectedMember || isUnavailable} onClick={() => submit('Present')}>Sign in worker</button></div></article></>
}

function WorkerSignInPage({ members, entries, strictSignIn, defaultSignIn, allowMultipleDailyShifts, onAttendance, onMarkAttendance, onSuccess }: { members: Member[]; entries: AttendanceEntry[]; strictSignIn: boolean; defaultSignIn: string; allowMultipleDailyShifts: boolean; onAttendance: () => void; onMarkAttendance: (memberId: number, status: 'Present' | 'Absent') => boolean | void; onSuccess?: (count: number) => void }) { return <CurrentWorkerSignInPage members={members} entries={entries} strictSignIn={strictSignIn} defaultSignIn={defaultSignIn} allowMultipleDailyShifts={allowMultipleDailyShifts} onAttendance={onAttendance} onMarkAttendance={onMarkAttendance} onSuccess={onSuccess} /> }

function RollPage({ onOpenSignIn, onOpenSignOut }: { onOpenSignIn: (mode: 'individual' | 'bulk') => void; onOpenSignOut: (mode: 'individual' | 'bulk') => void }) {
  const [choice, setChoice] = useState<'Sign in' | 'Sign out' | null>(null)
  const choose = (mode: 'individual' | 'bulk') => {
    if (choice === 'Sign in') onOpenSignIn(mode)
    if (choice === 'Sign out') onOpenSignOut(mode)
    const targetPage = choice === 'Sign in' ? 'Worker sign-in' : 'Worker checkout'
    window.history.replaceState({}, '', `${pagePaths[targetPage]}${mode === 'bulk' ? '?mode=bulk' : ''}`)
    setChoice(null)
  }
  return <><PageHeading eyebrow="PEOPLE / ROLL" title="ROLL" subtitle="Choose a worker action to record today’s attendance." /><section className="roll-grid"><button className="roll-card" onClick={() => setChoice('Sign in')}><span className="roll-card-icon">↗</span><span><strong>Sign in</strong><small>Record when a worker starts their shift.</small></span><b>→</b></button><button className="roll-card" onClick={() => setChoice('Sign out')}><span className="roll-card-icon">↘</span><span><strong>Sign out</strong><small>Complete a worker’s shift at the end of the day.</small></span><b>→</b></button></section>{choice && <AttendanceChoiceModal action={choice} onClose={() => setChoice(null)} onChoose={(_, mode) => choose(mode)} />}</>
}

function AttendanceChoiceModal({ action, onClose, onChoose }: { action: 'Sign in' | 'Sign out'; onClose: () => void; onChoose: (action: 'Sign in' | 'Sign out', mode: 'individual' | 'bulk') => void }) {
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])
  return <div className="attendance-choice-backdrop" role="dialog" aria-modal="true" aria-labelledby="attendance-choice-title"><section className="attendance-choice"><button className="choice-close" aria-label="Close" onClick={onClose}>×</button><p className="eyebrow">WORKER ATTENDANCE</p><h2 id="attendance-choice-title">How would you like to {action.toLowerCase()}?</h2><p>Choose one worker or manage several workers together.</p><div className="attendance-choice-actions"><button className="choice-card" onClick={() => onChoose(action, 'individual')}><strong>Individual</strong><span>Select one worker and record the action.</span><b>→</b></button><button className="choice-card choice-card-accent" onClick={() => onChoose(action, 'bulk')}><strong>Bulk</strong><span>Select workers by department and process them together.</span><b>→</b></button></div></section></div>
}

function WorkerSignOutPage({ members, entries, onMarkSignOut, onSuccess }: { members: Member[]; entries: AttendanceEntry[]; onMarkSignOut: (memberId: number) => boolean | Promise<boolean>; onSuccess?: (count: number) => void }) { if (new URLSearchParams(window.location.search).get('mode') === 'bulk') return <BulkAttendancePage action="Sign out" members={members} entries={entries} onMarkAttendance={() => undefined} onMarkSignOut={onMarkSignOut} onSuccess={onSuccess || (() => undefined)} />; const [selectedDepartment, setSelectedDepartment] = useState(''); const [selectedWorkerId, setSelectedWorkerId] = useState<number | ''>(''); const departments = Array.from(new Set(members.map((member) => member.department))); const visibleMembers = selectedDepartment ? members.filter((member) => member.department === selectedDepartment) : []; const selectedMember = visibleMembers.find((member) => member.id === selectedWorkerId); const entry = selectedMember ? entries.find((item) => item.memberId === selectedMember.id && item.date === today) : undefined; const isOff = entry?.status === 'Off'; const isSignedIn = entry?.status === 'Present' || entry?.status === 'Late'; return <><PageHeading eyebrow="PEOPLE / WORKER CHECKOUT" title="Worker checkout" subtitle="Record the successful sign-out and complete the worker's shift." /><article className="panel member-form"><PanelHeading title="Complete a shift" subtitle="Only workers with a successful sign-in can be checked out." /><div className="form-grid"><label><span>Department</span><select value={selectedDepartment} onChange={(event) => { setSelectedDepartment(event.target.value); setSelectedWorkerId('') }}><option value="">Select department</option>{departments.map((department) => <option key={department}>{department}</option>)}</select></label><label><span>Worker</span><select value={selectedWorkerId} disabled={!selectedDepartment} onChange={(event) => setSelectedWorkerId(Number(event.target.value) || '')}><option value="">Select worker</option>{visibleMembers.map((member) => <option key={member.id} value={member.id}>{member.name} (ID: {member.id})</option>)}</select></label></div>{selectedMember && <div className="signout-card"><p className="eyebrow">SELECTED WORKER</p><h2>{selectedMember.name}</h2><p>{isOff ? 'Off today. Sign-out is unavailable.' : isSignedIn ? `Expected sign-out: ${selectedMember.signOutTime}` : 'No active sign-in recorded for today.'}</p><button className="primary-button" disabled={!isSignedIn || isOff || entry?.checkOut !== '—'} onClick={async () => { if (await onMarkSignOut(selectedMember.id)) onSuccess?.(1) }}>{entry?.checkOut && entry.checkOut !== '—' ? `Shift completed at ${entry.checkOut}` : 'Record worker checkout'}</button></div>}</article></> }

function LiveWorkspaceOverview({ businessName, memberName, memberRole, members, attendance, entries, sales, inventory, categoryThresholds, onAttendance }: { businessName: string; memberName: string; memberRole: string; members: Member[]; attendance: AttendanceEntry[]; entries: AttendanceEntry[]; sales: Sale[]; inventory: InventoryItem[]; categoryThresholds: Record<string, number>; onAttendance: () => void }) {
  const [now, setNow] = useState(new Date())
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 60000); return () => window.clearInterval(timer) }, [])
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening'
  const present = attendance.filter((entry) => entry.status === 'Present').length
  const late = attendance.filter((entry) => entry.status === 'Late').length
  const off = attendance.filter((entry) => entry.status === 'Off').length
  const coverage = members.length ? Math.round(((present + late) / members.length) * 100) : 0
  const salesTotal = sales.reduce((sum, sale) => sum + (Number(sale.amount) || 0), 0)
  const completedEntries = entries.filter((entry) => entry.checkOut !== '—' && entry.date.slice(0, 7) === today.slice(0, 7))
  const payrollTotal = completedEntries.reduce((sum, entry) => sum + (members.find((member) => member.id === entry.memberId)?.payRate || 0), 0) - ((window as any).__biztrackDeductions || []).filter((deduction: Deduction) => deduction.date.slice(0, 7) === today.slice(0, 7)).reduce((sum: number, deduction: Deduction) => sum + deduction.amount, 0)
  const lowStock = inventory.filter((item) => item.quantity <= (categoryThresholds[item.category] ?? item.reorderAt)).length
  const dateLabel = formatDate(now.toISOString())
  const timeLabel = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  return <><PageHeading eyebrow={`${businessName.toUpperCase()} / ${memberRole.toUpperCase()} · ${dateLabel} · ${timeLabel}`} title={`${greeting}, ${memberName} ✦`} subtitle={`Here’s what’s happening across ${businessName} today.`} action={<button className="primary-button" onClick={onAttendance}>View attendance <span>→</span></button>} /><section className="metric-grid"><Metric title="Today’s sales" value={`KES ${salesTotal.toLocaleString()}`} detail={`${sales.length} record${sales.length === 1 ? '' : 's'} today`} accent="coral" /><Metric title="Team attendance" value={`${present + late} / ${members.length}`} detail={`${coverage}% present today`} accent="teal" /><Metric title="Payroll this month" value={`KES ${payrollTotal.toLocaleString()}`} detail={`${completedEntries.length} completed shift${completedEntries.length === 1 ? '' : 's'}`} accent="yellow" /><Metric title="Stock alerts" value={String(lowStock).padStart(2, '0')} detail={lowStock ? 'Needs attention' : 'Stock is healthy'} accent="lilac" /></section><section className="dashboard-grid"><article className="panel attendance-panel"><PanelHeading title="Attendance today" subtitle={`Live view of ${businessName}’s team`} action={<button className="text-button" onClick={onAttendance}>View all <span>→</span></button>} /><div className="attendance-summary"><div><strong>{present}</strong><span>Present</span></div><div><strong>{String(late).padStart(2, '0')}</strong><span>Late</span></div><div><strong>{String(off).padStart(2, '0')}</strong><span>Off today</span></div><div className="attendance-ring"><div><strong>{coverage}%</strong><span>of team</span></div></div></div><div className="table-wrap"><table><thead><tr><th>TEAM MEMBER</th><th>DEPARTMENT</th><th>STATUS</th><th>CHECK-IN</th></tr></thead><tbody>{members.slice(0, 6).map((member) => { const entry = attendance.find((item) => item.memberId === member.id); return <tr key={member.id}><td><div className="person-cell"><span className={`avatar avatar-${member.color}`}>{member.initials}</span><strong>{member.name}</strong></div></td><td>{member.department}</td><td><span className={`status-pill ${(entry?.status || 'Absent').toLowerCase()}`}><i></i>{entry?.status || 'Absent'}</span></td><td>{entry?.checkIn || '—'}</td></tr> })}</tbody></table></div></article></section></>
}

function AdminSidebar({ activeNav, onNavigate, onSignOut }: { activeNav: string; onNavigate: (page: string) => void; onSignOut: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const items = [{ label: 'Dashboard', icon: '◈' }, { label: 'Business', icon: '▦' }, { label: 'Users', icon: '◎' }, { label: 'Register a new business', icon: '+' }, { label: 'Activate business', icon: '✓' }, { label: 'Activation codes', icon: '#' }, { label: 'Packages', icon: 'KES' }, { label: 'Admin settings', icon: '⚙' }]
  const navigateFromSidebar = (page: string) => { setExpanded(false); onNavigate(page) }
  return <><button className="sidebar-toggle" aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'} aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}><span>{expanded ? '‹' : '☰'}</span><b>{expanded ? 'Collapse menu' : 'Menu'}</b></button><aside className={`sidebar ${expanded ? 'sidebar-expanded' : ''}`}><button className="brand" onClick={() => navigateFromSidebar('Dashboard')}><span className="brand-mark">b</span><span>BizTrack</span></button><div className="workspace-switcher"><span className="workspace-dot">B</span><span><strong>Site admin</strong><small>Platform workspace</small></span></div><nav aria-label="Site admin navigation"><p className="nav-label">SITE ADMIN</p>{items.map((item) => <button key={item.label} className={`nav-item ${activeNav === item.label || (item.label === 'Dashboard' && activeNav === 'Admin') ? 'active' : ''}`} onClick={() => navigateFromSidebar(item.label)}><span className="nav-icon">{item.icon}</span>{item.label}</button>)}</nav><div className="sidebar-footer"><div className="help-mark">?</div><span>Admin help</span><button className="sidebar-signout" onClick={onSignOut}>↪ Sign out</button></div></aside></>
}

function MaintenancePage({ settings, siteAdminAccount, onAdminLogin, onNavigate }: { settings: PlatformSettings; siteAdminAccount: OwnerAccount | null; onAdminLogin: () => void; onNavigate: (page: string) => void }) {
  return <main className="maintenance-page"><section className="maintenance-copy"><p className="eyebrow">{settings.platformName.toUpperCase()} / MAINTENANCE</p><h1>This site is under maintenance.</h1><p>We are preparing to serve you better. Business owners and team members cannot sign in until maintenance is complete.</p><a href={`mailto:${settings.supportEmail}`}>Contact support</a></section><section className="maintenance-visual"><img src="/maintenance.svg" alt="Two disconnected plugs during maintenance" /></section><section className="maintenance-admin"><AdminSignInPage ownerAccount={null} members={[]} siteAdminAccount={siteAdminAccount} onLogin={() => undefined} onAdminLogin={onAdminLogin} onNavigate={onNavigate} /></section></main>
}

type AdminUser = { id: number; tenantId: string; name: string; business: string; department: string; rawMembers: Partial<Member>[]; isOwner?: boolean }

function DeleteBusinessPage({ account, onCancel, onDelete }: { account?: BusinessAccount; onCancel: () => void; onDelete: (accountId: number) => Promise<void> | void }) {
  const [confirmations, setConfirmations] = useState(['', '', ''])
  const canDelete = Boolean(account && confirmations.every((value) => value.trim() === account.businessName))
  if (!account) return <main className="access-denied"><div className="panel"><h1>Business not found</h1><button className="primary-button" onClick={onCancel}>Back to businesses</button></div></main>
  return <main className="auth-page delete-business-page"><section className="admin-modal delete-business-card" role="dialog" aria-labelledby="delete-business-title"><p className="eyebrow">DANGER ZONE / DELETE BUSINESS</p><h1 id="delete-business-title">Delete {account.businessName}?</h1><p className="subheading">This permanently removes the business, its owner, workers, permissions, workspace records, and sessions. Type the exact business name three times to continue.</p><div className="delete-business-summary"><strong>{account.businessName}</strong><span>{account.plan} · Owner: {account.ownerName}</span></div><div className="delete-confirm-fields">{confirmations.map((value, index) => <label className="login-field" key={index}><span>Confirmation {index + 1}</span><input value={value} onChange={(event) => setConfirmations((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} placeholder={account.businessName} /></label>)}</div><div className="form-actions"><button type="button" className="secondary-button" onClick={onCancel}>Cancel</button><button type="button" className="primary-button delete-confirm-button" disabled={!canDelete} onClick={() => onDelete(account.id)}>Delete permanently</button></div></section></main>
}

function ActivateBusinessPage({ accounts, requests, reviewDecisions, onActivateAccount, onDeclineAccount, onActivateRequest, onDeclineRequest, onSaveReviewDecision, activeNav, onNavigate, onSignOut }: { accounts: BusinessAccount[]; requests: RegistrationRequest[]; reviewDecisions: Record<string, 'Activated' | 'Declined'>; onActivateAccount: (accountId: number) => void; onDeclineAccount: (accountId: number) => void; onActivateRequest: (request: RegistrationRequest) => void; onDeclineRequest: (requestId: number) => void; onSaveReviewDecision: (key: string, decision: 'Activated' | 'Declined') => void; activeNav: string; onNavigate: (page: string) => void; onSignOut: () => void }) {
  const pendingAccounts = accounts.filter((account) => account.status === 'Trial' || businessPackageExpired(account) || reviewDecisions[`account:${account.id}`])
  const accountDecisions = Object.fromEntries(accounts.map((account) => { const savedDecision = reviewDecisions[`account:${account.id}`]; const decision = savedDecision === 'Activated' && account.status === 'Active' || savedDecision === 'Declined' && account.status === 'Paused' ? savedDecision : undefined; return [account.id, decision] }))
  const decisionForAccount = (account: BusinessAccount) => { const savedDecision = accountDecisions[account.id]; return savedDecision === 'Activated' && account.status === 'Active' || savedDecision === 'Declined' && account.status === 'Paused' ? savedDecision : undefined }
  const setAccountDecisions = (update: (current: Record<number, 'Activated' | 'Declined' | undefined>) => Record<number, 'Activated' | 'Declined' | undefined>) => { const next = update(accountDecisions); Object.entries(next).forEach(([accountId, decision]) => { if (decision) onSaveReviewDecision(`account:${accountId}`, decision) }) }
  const reviewRequests = requests
  return <div className="app-shell"><AdminSidebar activeNav={activeNav} onNavigate={onNavigate} onSignOut={onSignOut} /><main className="main-content"><header className="topbar"><div className="breadcrumbs"><span>Site admin</span><b>/</b><strong>Activate business</strong></div></header><div className="page-content"><PageHeading eyebrow="SITE ADMIN / REVIEW" title="Business review" subtitle="Review expired subscriptions and client registrations that need a decision." /><article className="panel team-panel activation-review-panel"><div className="table-wrap"><table className="activation-review-table"><thead><tr><th>BUSINESS</th><th>OWNER / APPLICANT</th><th>REASON</th><th>PLAN</th><th>PACKAGE ENDS</th><th>ACTIONS</th></tr></thead><tbody>{pendingAccounts.map((account) => { const decision = accountDecisions[account.id]; return <tr key={`account-${account.id}`}><td><strong>{account.businessName}</strong><small>{account.email}</small></td><td>{account.ownerName}</td><td>{businessPackageExpired(account) ? 'Subscription expired' : 'Awaiting activation'}</td><td>{account.plan}</td><td>{account.nextBilling || '—'}</td><td><div className="review-actions">{decision ? <strong className={decision === 'Activated' ? 'review-activated' : 'review-declined'}>{decision}</strong> : <><button type="button" className="table-action table-action-view" onClick={() => { onActivateAccount(account.id); setAccountDecisions((current) => ({ ...current, [account.id]: 'Activated' })) }}>Activate</button><button type="button" className="table-action table-action-danger" onClick={() => { onDeclineAccount(account.id); setAccountDecisions((current) => ({ ...current, [account.id]: 'Declined' })) }}>Decline</button></>}</div></td></tr> })}{reviewRequests.map((request) => { const decision = request.reviewStatus; return <tr key={`request-${request.id}`}><td><strong>{request.businessName}</strong><small>{request.email || 'No email supplied'}</small></td><td>{request.applicantName}</td><td>{request.issue}</td><td>{request.plan || 'Not selected'}</td><td>—</td><td><div className="review-actions">{decision ? <strong className={decision === 'Activated' ? 'review-activated' : 'review-declined'}>{decision}</strong> : <><button type="button" className="table-action table-action-view" onClick={() => onActivateRequest(request)}>Activate</button><button type="button" className="table-action table-action-danger" onClick={() => onDeclineRequest(request.id)}>Decline</button></>}</div></td></tr> })}{!pendingAccounts.length && !reviewRequests.length && <tr><td colSpan={6}><div className="permission-empty"><strong>No businesses require review</strong><p>Expired subscriptions and unsuccessful client registrations will appear here.</p></div></td></tr>}</tbody></table></div></article></div></main></div>
}

function AdminUsersPage({ accounts, activeNav, onNavigate, onSignOut }: { accounts: BusinessAccount[]; activeNav: string; onNavigate: (page: string) => void; onSignOut: () => void }) {
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [newPassword, setNewPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    if (!supabase) return
    const loadUsers = async () => {
      const snapshots = await Promise.all(accounts.map(async (account) => ({ account, result: await supabase.from('workspace_snapshots').select('payload').eq('tenant_id', account.tenantId).maybeSingle() })))
      const nextUsers = snapshots.flatMap(({ account, result }) => {
        const snapshot = result.data?.payload as Partial<WorkspaceSnapshot> | undefined
        const rawMembers = snapshot?.members || []
        const access = snapshot?.accessByMember || {}
        const owner = { id: account.id, tenantId: account.tenantId, name: account.ownerName, business: account.businessName, department: 'Owner', rawMembers, isOwner: true }
        const workers = rawMembers.map((rawMember, index) => {
          const member = normalizeMember(rawMember, index, account.tenantId)
          return member.hasAccount && (access[member.id] || []).length ? { id: member.id, tenantId: account.tenantId, name: member.name, business: account.businessName, department: member.department, rawMembers } : null
        }).filter((user): user is AdminUser => Boolean(user))
        return [owner, ...workers]
      })
      setUsers(nextUsers)
    }
    void loadUsers()
  }, [accounts])
  const closeModal = () => { setSelectedUser(null); setNewPassword(''); setConfirmation(''); setError('') }
  const resetPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedUser) return
    if (newPassword.length < 6) { setError('New password must be at least 6 characters.'); return }
    if (newPassword !== confirmation) { setError('New password and confirmation do not match.'); return }
    const passwordHash = await hashPassword(newPassword)
    if (selectedUser.isOwner) {
      if (supabase) await supabase.from('business_accounts').update({ password: passwordHash }).eq('id', selectedUser.id)
      closeModal()
      return
    }
    const nextMembers = selectedUser.rawMembers.map((rawMember, index) => {
      const member = normalizeMember(rawMember, index, selectedUser.tenantId)
      return member.id === selectedUser.id ? { ...rawMember, password: passwordHash } : rawMember
    })
    if (supabase) {
      const { data } = await supabase.from('workspace_snapshots').select('payload').eq('tenant_id', selectedUser.tenantId).maybeSingle()
      const payload = { ...(data?.payload as Partial<WorkspaceSnapshot> || {}), members: nextMembers }
      await supabase.from('workspace_snapshots').upsert({ tenant_id: selectedUser.tenantId, payload, updated_at: new Date().toISOString() }, { onConflict: 'tenant_id' })
    }
    closeModal()
  }
  return <div className="app-shell"><AdminSidebar activeNav={activeNav} onNavigate={onNavigate} onSignOut={onSignOut} /><main className="main-content"><header className="topbar"><div className="breadcrumbs"><span>Site admin</span><b>/</b><strong>Users</strong></div></header><div className="page-content"><PageHeading eyebrow="SITE ADMIN / USERS" title="Users" subtitle="Manage account holders who have been granted workspace access by their business owner." /><article className="panel team-panel"><div className="table-wrap"><table><thead><tr><th>NAME</th><th>BUSINESS</th><th>DEPARTMENT</th><th>RESET PASSWORD</th></tr></thead><tbody>{users.length ? users.map((user) => <tr key={`${user.tenantId}-${user.id}`}><td><strong>{user.name}</strong></td><td>{user.business}</td><td>{user.department}</td><td><button className="secondary-button" type="button" onClick={() => setSelectedUser(user)}>Reset password</button></td></tr>) : <tr><td colSpan={4}><div className="permission-empty"><strong>No users with granted access</strong><p>Users appear here after a business owner creates an account and grants page permissions.</p></div></td></tr>}</tbody></table></div></article></div></main>{selectedUser && <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeModal() }}><section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="reset-password-title"><button className="admin-modal-close" type="button" aria-label="Close" onClick={closeModal}>×</button><p className="eyebrow">USER ACCESS</p><h2 id="reset-password-title">Reset password</h2><p className="admin-modal-user"><strong>{selectedUser.name}</strong><span>{selectedUser.department}</span></p><form onSubmit={resetPassword}><label className="login-field"><span>Current password</span><input value="Can not be seen since it is hashed in the database" readOnly /></label><label className="login-field"><span>New password</span><input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={6} required /></label><label className="login-field"><span>Confirm new password</span><input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} minLength={6} required /></label>{error && <p className="login-error" role="alert">{error}</p>}<div className="form-actions"><button className="secondary-button" type="button" onClick={closeModal}>Cancel</button><button className="primary-button" type="submit">Update password</button></div></form></section></div>}</div>
}

function AdminDashboardPage({ accounts, activeNav, onNavigate, onCreate, onSignOut }: { accounts: BusinessAccount[]; activeNav: string; onNavigate: (page: string) => void; onCreate: () => void; onSignOut: () => void }) {
  const activeAccounts = accounts.filter((account) => account.status === 'Active').length
  const trialAccounts = accounts.filter((account) => account.status === 'Trial').length
  const monthlyRevenue = accounts.reduce((sum, account) => sum + account.monthlyPrice, 0)
  return <div className="app-shell"><AdminSidebar activeNav={activeNav} onNavigate={onNavigate} onSignOut={onSignOut} /><main className="main-content"><header className="topbar"><div className="breadcrumbs"><span>Site admin</span><b>/</b><strong>Dashboard</strong></div></header><div className="page-content"><PageHeading eyebrow="SITE ADMIN / SUMMARY" title="Dashboard" subtitle="A clear view of the businesses and registration activity across your platform." action={<button className="primary-button" onClick={onCreate}><span>＋</span> Register a business</button>} /><section className="metric-grid"><Metric title="Active businesses" value={String(activeAccounts)} detail="Paying customers" accent="teal" /><Metric title="Trials" value={String(trialAccounts)} detail="Awaiting onboarding" accent="yellow" /><Metric title="Monthly revenue" value={`KES ${monthlyRevenue.toLocaleString()}`} detail="Across all plans" accent="coral" /><Metric title="Businesses" value={String(accounts.length)} detail="In the system" accent="lilac" /></section><article className="panel team-panel"><PanelHeading title="Business activity" subtitle="The latest workspaces created on the platform" /><div className="table-wrap"><table><thead><tr><th>BUSINESS</th><th>OWNER</th><th>PLAN</th><th>STATUS</th></tr></thead><tbody>{accounts.slice(0, 5).map((account) => <tr key={account.id}><td><strong>{account.businessName}</strong><small>{account.email}</small></td><td>{account.ownerName}</td><td>{account.plan}</td><td><span className="status-pill status-pill-teal">{account.status}</span></td></tr>)}</tbody></table></div></article></div></main></div>
}

function RegistrationRequestsPage({ requests, activeNav, onNavigate }: { requests: RegistrationRequest[]; activeNav: string; onNavigate: (page: string) => void }) {
  return <div className="app-shell"><AdminSidebar activeNav={activeNav} onNavigate={onNavigate} onSignOut={() => onNavigate('Welcome')} /><main className="main-content"><header className="topbar"><div className="breadcrumbs"><span>Site admin</span><b>/</b><strong>Registration requests</strong></div></header><div className="page-content"><PageHeading eyebrow="SITE ADMIN / REVIEW" title="Registration requests" subtitle="Review registrations that stopped before a business account was created." /><article className="panel team-panel">{requests.length ? <div className="table-wrap"><table><thead><tr><th>APPLICANT</th><th>BUSINESS</th><th>ISSUE</th><th>DATE</th></tr></thead><tbody>{requests.map((request) => <tr key={request.id}><td><strong>{request.applicantName}</strong></td><td>{request.businessName}</td><td>{request.issue}</td><td>{request.submittedAt}</td></tr>)}</tbody></table></div> : <div className="permission-empty"><strong>No registration requests</strong><p>Incomplete or unsuccessful registrations will appear here for review.</p></div>}</article></div></main></div>
}

function LegacyAdminDashboardPage({ accounts, onCreate, onViewBusinessAccounts, onViewSubscriptions, onOpenSettings, onSignOut }: { accounts: BusinessAccount[]; onCreate: () => void; onViewBusinessAccounts: () => void; onViewSubscriptions: () => void; onOpenSettings: () => void; onSignOut: () => void }) {
  const activeAccounts = accounts.filter((account) => account.status === 'Active').length
  const trialAccounts = accounts.filter((account) => account.status === 'Trial').length
  const monthlyRevenue = accounts.reduce((sum, account) => sum + account.monthlyPrice, 0)
  const recentAccounts = accounts.slice(0, 4)
  return <div className="app-shell"><aside className="sidebar"><button className="brand" onClick={onViewBusinessAccounts}><span className="brand-mark">b</span><span>biz track admin</span></button><nav aria-label="Admin navigation"><p className="nav-label">ADMIN</p><button className="nav-item active" onClick={onViewBusinessAccounts}><span className="nav-icon">◈</span>Business accounts</button><button className="nav-item" onClick={onViewSubscriptions}><span className="nav-icon">KES</span>Subscriptions</button><button className="nav-item" onClick={onOpenSettings}><span className="nav-icon">⚙</span>Platform settings</button><button className="nav-item" onClick={onSignOut}><span className="nav-icon">↪</span>Sign out</button></nav></aside><main className="main-content"><header className="topbar"><div className="breadcrumbs"><span>Admin portal</span><b>/</b><strong>Overview</strong></div></header><div className="page-content"><PageHeading eyebrow="SITE ADMIN / CONTROL" title="Platform overview" subtitle="Manage every business workspace, subscription, and the base app configuration." action={<button className="primary-button" onClick={onCreate}><span>＋</span> Create business account</button>} /><section className="metric-grid"><Metric title="Active businesses" value={String(activeAccounts)} detail="Paying customers" accent="teal" /><Metric title="Trials" value={String(trialAccounts)} detail="Awaiting onboarding" accent="yellow" /><Metric title="Monthly revenue" value={`KES ${monthlyRevenue.toLocaleString()}`} detail="Across all plans" accent="coral" /><Metric title="Accounts" value={String(accounts.length)} detail="In the system" accent="lilac" /></section><section className="dashboard-grid"><article className="panel team-panel"><PanelHeading title="Recent business accounts" subtitle="Newest workspaces created in the platform" /><div className="table-wrap"><table><thead><tr><th>BUSINESS</th><th>OWNER</th><th>PLAN</th><th>STATUS</th></tr></thead><tbody>{recentAccounts.map((account) => <tr key={account.id}><td>{account.businessName}</td><td>{account.ownerName}</td><td>{account.plan}</td><td><span className="status-pill status-pill-teal">{account.status}</span></td></tr>)}</tbody></table></div></article><article className="panel member-form"><PanelHeading title="Quick actions" subtitle="Keep the platform and customer accounts moving." /><div className="form-grid single-field"><button type="button" className="primary-button" onClick={onCreate}>Create a new business account</button><button type="button" className="secondary-button" onClick={onViewBusinessAccounts}>View all businesses</button><button type="button" className="secondary-button" onClick={onViewSubscriptions}>Manage subscriptions</button><button type="button" className="secondary-button" onClick={onOpenSettings}>App settings</button></div></article></section></div></main></div>
}

function ActivationCodesPage({ codes, packages, onCreate, activeNav, onNavigate, onSignOut }: { codes: ActivationCode[]; packages: PackageConfig[]; onCreate: (packageName: SubscriptionPlan) => string; activeNav: string; onNavigate: (page: string) => void; onSignOut: () => void }) {
  const [packageName, setPackageName] = useState<SubscriptionPlan>('Starter')
  const [newCode, setNewCode] = useState('')
  const availablePackages = (packages || []).filter((item): item is PackageConfig => Boolean(item?.name && item.active))
  const create = () => setNewCode(onCreate(packageName))
  return <div className="app-shell"><AdminSidebar activeNav={activeNav} onNavigate={onNavigate} onSignOut={onSignOut} /><main className="main-content"><header className="topbar"><div className="breadcrumbs"><span>Site admin</span><b>/</b><strong>Activation codes</strong></div></header><div className="page-content"><PageHeading eyebrow="SITE ADMIN / ACCESS" title="Activation codes" subtitle="Create package-specific codes for business registration." /><article className="panel member-form"><PanelHeading title="Create a code" subtitle="Codes can be used once during business registration." /><div className="form-grid"><label><span>Package</span><select value={packageName} onChange={(event) => setPackageName(event.target.value as SubscriptionPlan)}>{availablePackages.map((item) => <option key={item.name}>{item.name}</option>)}</select></label><div className="form-actions"><button className="primary-button" type="button" onClick={create} disabled={!availablePackages.length}>＋ Create activation code</button>{newCode && <strong>{newCode}</strong>}</div></div></article><article className="panel team-panel"><PanelHeading title="Code inventory" subtitle={`${codes.filter((code) => code.status === 'Available').length} available codes`} /><div className="table-wrap"><table><thead><tr><th>CODE</th><th>PACKAGE</th><th>STATUS</th><th>CREATED</th><th>USED BY</th></tr></thead><tbody>{codes.map((code) => <tr key={code.id}><td><strong>{code.code}</strong></td><td>{code.packageName}</td><td>{code.status}</td><td>{code.createdAt}</td><td>{code.usedBy || '—'}</td></tr>)}</tbody></table></div></article></div></main></div>
}

function ConfiguredPackagesPage({ packages, onUpdate, onSave, activeNav, onNavigate, onSignOut }: { packages: PackageConfig[]; onUpdate: (name: SubscriptionPlan, updates: Partial<PackageConfig>) => void; onSave: () => void; activeNav: string; onNavigate: (page: string) => void; onSignOut: () => void }) {
  const updateDurationUnit = (name: string, value: string) => onUpdate(name, { durationUnit: value as PackageConfig['durationUnit'] })
  useEffect(() => {
    const stack = document.querySelector('.page-content .settings-stack')
    if (!stack || stack.querySelector('.package-save-button')) return
    const actions = document.createElement('div')
    actions.className = 'form-actions'
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'primary-button package-save-button'
    button.textContent = 'Save changes'
    button.addEventListener('click', onSave)
    actions.appendChild(button)
    stack.appendChild(actions)
    return () => actions.remove()
  }, [onSave, packages])
  return <div className="app-shell"><AdminSidebar activeNav={activeNav} onNavigate={onNavigate} onSignOut={onSignOut} /><main className="main-content"><header className="topbar"><div className="breadcrumbs"><span>Site admin</span><b>/</b><strong>Packages</strong></div></header><div className="page-content"><PageHeading eyebrow="SITE ADMIN / PACKAGES" title="Package management" subtitle="Set the package name, amount, duration, seats, and included capabilities." /><section className="settings-stack">{packages.map((item) => <article className="panel member-form" key={item.name}><PanelHeading title={item.name} subtitle="Changes apply to new activation codes and registrations." /><div className="form-grid"><label><span>Package name</span><input value={item.name} onChange={(event) => onUpdate(item.name, { name: event.target.value || 'Package' })} /></label><label><span>Amount</span><input type="number" min="0" value={item.price} onChange={(event) => onUpdate(item.name, { price: Number(event.target.value) || 0 })} /></label><label><span>Duration</span><input type="number" min="1" value={item.duration} onChange={(event) => onUpdate(item.name, { duration: Number(event.target.value) || 1 })} /></label><label><span>Duration unit</span><select value={item.durationUnit} onChange={(event) => updateDurationUnit(item.name, event.target.value)}><option value="day">Day(s)</option><option value="week">Week(s)</option><option value="month">Month(s)</option><option value="year">Year(s)</option></select></label><label><span>Seats</span><input type="number" min="1" value={item.seats} onChange={(event) => onUpdate(item.name, { seats: Number(event.target.value) || 1 })} /></label><label><span>Description</span><input value={item.description} onChange={(event) => onUpdate(item.name, { description: event.target.value })} /></label></div><div className="settings-choice-group"><strong>Included features</strong><small>Check every capability included with this package.</small><div className="settings-choice-grid">{packageFeatures.map((feature) => <label key={feature} className={item.features.includes(feature) ? 'settings-choice enabled' : 'settings-choice'}><input type="checkbox" checked={item.features.includes(feature)} onChange={(event) => onUpdate(item.name, { features: event.target.checked ? [...item.features, feature] : item.features.filter((value) => value !== feature) })} /><span>{feature}</span></label>)}</div></div><label className="settings-choice enabled"><input type="checkbox" checked={item.active} onChange={(event) => onUpdate(item.name, { active: event.target.checked })} /><span>Available for registration</span></label></article>)}</section></div></main></div>
}

function PackagesPage({ packages, onUpdate, activeNav, onNavigate, onSignOut }: { packages: PackageConfig[]; onUpdate: (name: SubscriptionPlan, updates: Partial<PackageConfig>) => void; activeNav: string; onNavigate: (page: string) => void; onSignOut: () => void }) {
  return <div className="app-shell"><AdminSidebar activeNav={activeNav} onNavigate={onNavigate} onSignOut={onSignOut} /><main className="main-content"><header className="topbar"><div className="breadcrumbs"><span>Site admin</span><b>/</b><strong>Packages</strong></div></header><div className="page-content"><PageHeading eyebrow="SITE ADMIN / PACKAGES" title="Package management" subtitle="Set the package name, billing amount, duration, seats, and included capabilities." /><section className="settings-stack">{packages.map((item) => <article className="panel member-form" key={item.name}><PanelHeading title={item.name} subtitle="Changes apply to new activation codes and registrations." /><div className="form-grid"><label><span>Package name</span><input value={item.name} onChange={(event) => onUpdate(item.name, { name: event.target.value || 'Package' })} /></label><label><span>Amount</span><input type="number" min="0" value={item.price} onChange={(event) => onUpdate(item.name, { price: Number(event.target.value) || 0 })} /></label><label><span>Duration</span><input type="number" min="1" value={item.duration} onChange={(event) => onUpdate(item.name, { duration: Number(event.target.value) || 1 })} /></label><label><span>Duration unit</span><select value={item.durationUnit} onChange={(event) => onUpdate(item.name, { durationUnit: event.target.value as PackageConfig['durationUnit'] })}><option value="month">Month(s)</option><option value="year">Year(s)</option></select></label><label><span>Seats</span><input type="number" min="1" value={item.seats} onChange={(event) => onUpdate(item.name, { seats: Number(event.target.value) || 1 })} /></label><label><span>Description</span><input value={item.description} onChange={(event) => onUpdate(item.name, { description: event.target.value })} /></label></div><div className="settings-choice-group"><strong>Included features</strong><small>Check every capability included with this package.</small><div className="settings-choice-grid">{packageFeatures.map((feature) => <label key={feature} className={item.features.includes(feature) ? 'settings-choice enabled' : 'settings-choice'}><input type="checkbox" checked={item.features.includes(feature)} onChange={(event) => onUpdate(item.name, { features: event.target.checked ? [...item.features, feature] : item.features.filter((value) => value !== feature) })} /><span>{feature}</span></label>)}</div></div><label className="settings-choice enabled"><input type="checkbox" checked={item.active} onChange={(event) => onUpdate(item.name, { active: event.target.checked })} /><span>Available for registration</span></label></article>)}</section></div></main></div>
}

function AdminBusinessRegistrationPage({ onNavigate, onCreate, onBack }: { onNavigate: (page: string) => void; onCreate: (account: { businessName: string; ownerName: string; email: string; username: string; password: string; industry: string; plan: SubscriptionPlan }) => void; onBack: () => void }) {
  return <RegisterPage packages={[]} onNavigate={onNavigate} onRequestIssue={() => undefined} onComplete={(account) => onCreate({ businessName: account.business || 'New business', ownerName: account.name, email: `${account.username}@biztrack.app`, username: account.username, password: account.password, industry: account.industry || 'General', plan: account.plan || 'Starter' })} />
}

function AdminBusinessRegistrationWizard({ packages, defaultPlan, onNavigate, onCreate, onBack }: { packages: PackageConfig[]; defaultPlan: SubscriptionPlan; onNavigate: (page: string) => void; onCreate: (account: { businessName: string; ownerName: string; email: string; username: string; password: string; industry: string; plan: SubscriptionPlan }, activationCode: string) => boolean; onBack: () => void }) {
  const [step, setStep] = useState(1)
  const [details, setDetails] = useState({ name: '', phone: '', email: '', username: '', password: '', business: '', industry: '', plan: defaultPlan, code: '' })
  const [accepted, setAccepted] = useState(false)
  const [error, setError] = useState('')
  const availablePackages = (packages || []).filter((item): item is PackageConfig => Boolean(item?.name && item.active))
  const update = (event: FormEvent<HTMLInputElement | HTMLSelectElement>) => { const { name, value } = event.currentTarget; setDetails((current) => ({ ...current, [name]: value })) }
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError('')
    if (step === 1 && (!details.name.trim() || !details.phone.trim() || !details.email.trim() || details.username.trim().length < 3 || details.password.length < 6)) { setError('Complete the owner name, phone, email, username, and password.'); return }
    if (step === 2 && (!details.business.trim() || !details.industry.trim())) { setError('Enter the business name and industry.'); return }
    if (step === 3 && !accepted) { setError('Accept the terms and conditions to continue.'); return }
    if (step === 4) { if (!details.code.trim() || !onCreate({ businessName: details.business.trim(), ownerName: details.name.trim(), email: details.email.trim(), username: details.username.trim(), password: details.password, industry: details.industry.trim(), plan: details.plan }, details.code)) { setError('That activation code is invalid, already used, or belongs to another package.'); return } return }
    setStep((current) => current + 1)
  }
  const titles = ['Owner particulars', 'Business details', 'Package and terms', 'Activation code']
  return <div className="register-page"><header className="register-header"><button className="welcome-brand" onClick={onBack}><span className="welcome-mark">b</span><span>biz track admin</span></button><button className="register-back" onClick={onBack}>Back to dashboard</button></header><main className="register-layout"><section className="register-intro"><p className="welcome-kicker">SITE ADMIN / REGISTRATION</p><h1>Open a clear<br /><em>business workspace.</em></h1><p>Capture the owner, business, package, and activation details before the workspace is created.</p></section><section className="register-card"><div className="register-progress">{titles.map((title, index) => <div key={title} className={index + 1 <= step ? 'complete' : ''}><b>0{index + 1}</b><span>{title}</span></div>)}</div><form onSubmit={submit}><p className="eyebrow">STEP 0{step} OF 04</p><h2>{titles[step - 1]}</h2>{error && <p className="login-error" role="alert">{error}</p>}{step === 1 && <div className="form-grid register-fields"><label><span>Full name *</span><input name="name" value={details.name} onChange={update} required /></label><label><span>Phone number *</span><input name="phone" value={details.phone} onChange={update} required /></label><label><span>Email address *</span><input name="email" type="email" value={details.email} onChange={update} required /></label><label><span>Username *</span><input name="username" value={details.username} onChange={update} required /></label><label><span>Temporary password *</span><input name="password" type="password" value={details.password} onChange={update} required /></label></div>}{step === 2 && <div className="form-grid register-fields"><label><span>Business name *</span><input name="business" value={details.business} onChange={update} required /></label><label><span>Industry *</span><input name="industry" value={details.industry} onChange={update} placeholder="Retail, hospitality..." required /></label></div>}{step === 3 && <div className="form-grid register-fields"><label><span>Preferred package *</span><select name="plan" value={details.plan} onChange={update}>{availablePackages.map((item) => <option key={item.name} value={item.name}>{item.name} · KES {item.price}/month · {item.seats} seats</option>)}</select></label><label className="settings-choice enabled"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} /><span>I accept the terms and conditions.</span></label></div>}{step === 4 && <div className="form-grid register-fields"><label><span>Activation code *</span><input name="code" value={details.code} onChange={update} placeholder="e.g. BT-ABC123" autoFocus required /></label><p className="register-help">Enter a code created for the selected {details.plan} package.</p></div>}<div className="form-actions"><button type="button" className="secondary-button" onClick={() => step === 1 ? onBack() : setStep((current) => current - 1)}>Back</button><button className="primary-button" type="submit">{step === 4 ? 'Create business' : 'Continue'} <span>→</span></button></div></form></section></main></div>
}

function CreateBusinessAccountPage({ activeNav, onNavigate, onCreate, onBack, onSignOut }: { activeNav: string; onNavigate: (page: string) => void; onCreate: (account: { businessName: string; ownerName: string; email: string; username: string; password: string; industry: string; plan: SubscriptionPlan }) => void; onBack: () => void; onSignOut: () => void }) {
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget)
    const account = {
      businessName: String(form.get('businessName') || '').trim(),
      ownerName: String(form.get('ownerName') || '').trim(),
      email: String(form.get('email') || '').trim(),
      username: String(form.get('username') || '').trim(),
      password: String(form.get('password') || '').trim(),
      industry: String(form.get('industry') || '').trim(),
      plan: String(form.get('plan') || 'Starter') as SubscriptionPlan,
    }
    if (!account.businessName || !account.ownerName || !account.email || !account.username || account.password.length < 6 || !account.industry) return
    onCreate(account)
    event.currentTarget.reset()
  }
  return <div className="app-shell"><AdminSidebar activeNav={activeNav} onNavigate={onNavigate} onSignOut={onSignOut} /><main className="main-content"><header className="topbar"><div className="breadcrumbs"><span>Site admin</span><b>/</b><strong>Register a new business</strong></div></header><div className="page-content"><PageHeading eyebrow="SITE ADMIN / REGISTRATION" title="Register a new business" subtitle="Follow the same registration steps to create a business workspace." /><form className="panel member-form" onSubmit={submit}><div className="form-grid"><label><span>Business name</span><input name="businessName" placeholder="e.g. Bluefield Foods" required /></label><label><span>Owner name</span><input name="ownerName" placeholder="e.g. Ada Okafor" required /></label><label><span>Owner email</span><input name="email" type="email" placeholder="owner@business.com" required /></label><label><span>Owner username</span><input name="username" placeholder="owner username" required /></label><label><span>Password</span><input name="password" type="password" placeholder="At least 6 characters" required /></label><label><span>Industry</span><input name="industry" placeholder="Retail, Hospitality, Logistics..." required /></label><label><span>Plan</span><select name="plan" defaultValue="Starter"><option>Starter</option><option>Growth</option><option>Scale</option></select></label></div><div className="form-actions"><button type="button" className="secondary-button" onClick={onBack}>Back</button><button type="submit" className="primary-button"><span>＋</span> Create account</button></div></form></div></main></div>
}

function BusinessAccountsPage({ accounts, activeNav, onNavigate, onCreate, onSignOut, onBack, onUpdateStatus, onDelete }: { accounts: BusinessAccount[]; activeNav: string; onNavigate: (page: string) => void; onCreate: () => void; onSignOut: () => void; onBack?: () => void; onUpdateStatus?: (accountId: number, updates: Partial<Pick<BusinessAccount, 'status'>>) => void; onDelete?: (accountId: number) => void }) {
  if (onNavigate) return <AdminBusinessAccountsPage accounts={accounts} activeNav={activeNav} onNavigate={onNavigate} onCreate={onCreate} onSignOut={onSignOut} onUpdateStatus={onUpdateStatus || (() => undefined)} onDelete={onDelete || (() => undefined)} />
  return <div className="app-shell"><aside className="sidebar"><button className="brand" onClick={onBack}><span className="brand-mark">b</span><span>biz track admin</span></button><nav aria-label="Admin navigation"><p className="nav-label">ADMIN</p><button className="nav-item" onClick={onBack}><span className="nav-icon">◈</span>Overview</button><button className="nav-item active" onClick={() => undefined}><span className="nav-icon">◈</span>Business accounts</button><button className="nav-item" onClick={() => window.history.pushState({}, '', '/admin/subscriptions/')}><span className="nav-icon">KES</span>Subscriptions</button><button className="nav-item" onClick={() => window.history.pushState({}, '', '/admin/settings/')}><span className="nav-icon">⚙</span>Platform settings</button><button className="nav-item" onClick={() => window.history.pushState({}, '', '/signin/')}><span className="nav-icon">↪</span>Sign out</button></nav></aside><main className="main-content"><header className="topbar"><div className="breadcrumbs"><span>Admin portal</span><b>/</b><strong>Business accounts</strong></div></header><div className="page-content"><PageHeading eyebrow="SITE ADMIN / BUSINESS" title="Business accounts" subtitle="Track every workspace and the owner assigned to each one." action={<button className="primary-button" onClick={onCreate}><span>＋</span> New account</button>} /><article className="panel team-panel"><div className="table-wrap"><table><thead><tr><th>BUSINESS</th><th>OWNER</th><th>INDUSTRY</th><th>PLAN</th><th>STATUS</th><th>SEATS</th></tr></thead><tbody>{accounts.map((account) => <tr key={account.id}><td><strong>{account.businessName}</strong><small>{account.email}</small></td><td>{account.ownerName}</td><td>{account.industry}</td><td>{account.plan}</td><td><span className="status-pill status-pill-teal">{account.status}</span></td><td>{account.seats}</td></tr>)}</tbody></table></div></article><div className="form-actions"><button type="button" className="secondary-button" onClick={onBack}>Back</button></div></div></main></div>
}

function AdminBusinessAccountsPage({ accounts, activeNav, onNavigate, onCreate, onSignOut, onUpdateStatus, onDelete }: { accounts: BusinessAccount[]; activeNav: string; onNavigate: (page: string) => void; onCreate: () => void; onSignOut: () => void; onUpdateStatus: (accountId: number, updates: Partial<Pick<BusinessAccount, 'status'>>) => void; onDelete: (accountId: number) => void }) {
  const [viewAccount, setViewAccount] = useState<BusinessAccount | null>(null)
  const [suspendAccount, setSuspendAccount] = useState<BusinessAccount | null>(null)
  return <div className="app-shell"><AdminSidebar activeNav={activeNav} onNavigate={onNavigate} onSignOut={onSignOut} /><main className="main-content"><header className="topbar"><div className="breadcrumbs"><span>Site admin</span><b>/</b><strong>Business accounts</strong></div></header><div className="page-content"><PageHeading eyebrow="SITE ADMIN / BUSINESS" title="Business accounts" subtitle="Track every workspace, subscription, and owner from one place." action={<button className="primary-button" onClick={onCreate}><span>＋</span> New account</button>} /><article className="panel team-panel business-accounts-panel"><div className="table-wrap"><table className="business-accounts-table"><thead><tr><th>BUSINESS</th><th>OWNER</th><th>INDUSTRY</th><th>PLAN</th><th>STATUS</th><th>SEATS</th><th>ACTIONS</th></tr></thead><tbody>{accounts.map((account) => <tr key={account.id}><td><strong>{account.businessName}</strong><small>{account.email}</small></td><td><strong>{account.ownerName}</strong><small>{account.username}</small></td><td>{account.industry}</td><td><strong>{account.plan}</strong><small>Ends {account.nextBilling || 'not set'}</small></td><td><span className={`status-pill ${account.status === 'Active' ? 'status-pill-teal' : account.status === 'Paused' ? 'status-pill-coral' : 'status-pill-yellow'}`}>{account.status}</span></td><td>{account.seats}</td><td><div className="business-account-actions"><button type="button" className="table-action table-action-view" onClick={() => setViewAccount(account)}>View</button><button type="button" className="table-action" onClick={() => onUpdateStatus(account.id, { status: account.status === 'Paused' ? 'Active' : 'Paused' })}>{account.status === 'Paused' ? 'Reactivate' : 'Suspend'}</button><button type="button" className="table-action table-action-danger" onClick={() => onDelete(account.id)}>Delete</button></div></td></tr>)}</tbody></table></div></article></div></main>{viewAccount && <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setViewAccount(null) }}><section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="business-view-title"><button className="admin-modal-close" type="button" aria-label="Close" onClick={() => setViewAccount(null)}>×</button><p className="eyebrow">BUSINESS ACCOUNT</p><h2 id="business-view-title">{viewAccount.businessName}</h2><p className="admin-modal-user"><strong>{viewAccount.ownerName}</strong><span>{viewAccount.email} · {viewAccount.industry}</span></p><div className="business-account-detail-grid"><div><span>Plan</span><strong>{viewAccount.plan}</strong></div><div><span>Status</span><strong>{viewAccount.status}</strong></div><div><span>Seats</span><strong>{viewAccount.seats}</strong></div><div><span>Package ends</span><strong>{viewAccount.nextBilling || 'Not set'}</strong></div></div><div className="form-actions"><button type="button" className="secondary-button" onClick={() => setViewAccount(null)}>Close</button></div></section></div>}</div>
}

function SubscriptionPage({ accounts, onUpdate, onBack }: { accounts: BusinessAccount[]; onUpdate: (accountId: number, updates: Partial<Pick<BusinessAccount, 'status' | 'plan' | 'seats' | 'nextBilling'>>) => void; onBack: () => void }) {
  return <div className="app-shell"><aside className="sidebar"><button className="brand" onClick={onBack}><span className="brand-mark">b</span><span>biz track admin</span></button><nav aria-label="Admin navigation"><p className="nav-label">ADMIN</p><button className="nav-item" onClick={onBack}><span className="nav-icon">◈</span>Overview</button><button className="nav-item" onClick={() => window.history.pushState({}, '', '/admin/businesses/')}><span className="nav-icon">◈</span>Business accounts</button><button className="nav-item active" onClick={() => undefined}><span className="nav-icon">KES</span>Subscriptions</button><button className="nav-item" onClick={() => window.history.pushState({}, '', '/admin/settings/')}><span className="nav-icon">⚙</span>Platform settings</button><button className="nav-item" onClick={() => window.history.pushState({}, '', '/signin/')}><span className="nav-icon">↪</span>Sign out</button></nav></aside><main className="main-content"><header className="topbar"><div className="breadcrumbs"><span>Admin portal</span><b>/</b><strong>Subscriptions</strong></div></header><div className="page-content"><PageHeading eyebrow="SITE ADMIN / BILLING" title="Subscription management" subtitle="Update the plan, seats, billing date, and account status for each workspace." /><article className="panel team-panel"><div className="table-wrap"><table><thead><tr><th>BUSINESS</th><th>PLAN</th><th>SEATS</th><th>NEXT BILLING</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>{accounts.map((account) => <tr key={account.id}><td><strong>{account.businessName}</strong><small>{account.ownerName}</small></td><td><select value={account.plan} onChange={(event) => onUpdate(account.id, { plan: event.target.value as SubscriptionPlan })}><option>Starter</option><option>Growth</option><option>Scale</option></select></td><td><input type="number" min="1" value={account.seats} onChange={(event) => onUpdate(account.id, { seats: Number(event.target.value) || account.seats })} /></td><td><input type="date" value={account.nextBilling} onChange={(event) => onUpdate(account.id, { nextBilling: event.target.value })} /></td><td><select value={account.status} onChange={(event) => onUpdate(account.id, { status: event.target.value as SubscriptionStatus })}><option>Trial</option><option>Active</option><option>Paused</option><option>Canceled</option></select></td><td><button type="button" className="secondary-button" onClick={() => onUpdate(account.id, { status: 'Active', plan: account.plan })}>Apply</button></td></tr>)}</tbody></table></div></article><div className="form-actions"><button type="button" className="secondary-button" onClick={onBack}>Back</button></div></div></main></div>
}

function AdminPlatformSettingsShell({ activeNav, onNavigate, settings, siteAdminAccount, onSave }: { activeNav: string; onNavigate: (page: string) => void; settings: PlatformSettings; siteAdminAccount: OwnerAccount | null; onSave: (settings: PlatformSettings) => Promise<void> }) {
  return <div className="admin-shell"><AdminSidebar activeNav={activeNav} onNavigate={onNavigate} onSignOut={() => onNavigate('Welcome')} /><div className="admin-legacy-content"><PlatformSettingsPage activeNav={activeNav} onNavigate={onNavigate} settings={settings} siteAdminAccount={siteAdminAccount} onSave={onSave} /></div></div>
}

function PlatformSettingsPage({ activeNav, onNavigate, onBack, settings, siteAdminAccount, onSave }: { activeNav: string; onNavigate: (page: string) => void; onBack?: () => void; settings: PlatformSettings; siteAdminAccount: OwnerAccount | null; onSave: (settings: PlatformSettings) => Promise<void> }) {
  const [platformName, setPlatformName] = useState(settings.platformName)
  const [supportEmail, setSupportEmail] = useState(settings.supportEmail)
  const [whatsappNumber, setWhatsappNumber] = useState(settings.whatsappNumber)
  const [defaultPlan, setDefaultPlan] = useState(settings.defaultPlan)
  const [maintenanceMode, setMaintenanceMode] = useState(settings.maintenanceMode)
  const [saving, setSaving] = useState(false)
  const save = async () => {
    const nextSettings = { platformName, supportEmail, whatsappNumber: whatsappNumber.replace(/[^0-9]/g, ''), defaultPlan, maintenanceMode }
    setSaving(true)
    try { await onSave(nextSettings) } catch (saveError) { window.alert(saveError instanceof Error ? saveError.message : 'Could not save platform settings.') } finally { setSaving(false) }
  }
  useEffect(() => {
    const grid = document.querySelector('.page-content .member-form .form-grid')
    if (!grid || grid.querySelector('.whatsapp-support-field')) return
    const label = document.createElement('label')
    label.className = 'whatsapp-support-field'
    label.innerHTML = '<span>WhatsApp support number</span><input type="tel" placeholder="e.g. 254712345678"><small>Use the full international number without the plus sign.</small>'
    const input = label.querySelector('input') as HTMLInputElement
    input.value = whatsappNumber
    input.addEventListener('input', () => {
      setWhatsappNumber(input.value)
    })
    grid.appendChild(label)
    return () => label.remove()
  }, [])
  return <div className="app-shell"><aside className="sidebar"><button className="brand" onClick={onBack}><span className="brand-mark">b</span><span>biz track admin</span></button><nav aria-label="Admin navigation"><p className="nav-label">ADMIN</p><button className="nav-item" onClick={onBack}><span className="nav-icon">◈</span>Overview</button><button className="nav-item" onClick={() => window.history.pushState({}, '', '/admin/businesses/')}><span className="nav-icon">◈</span>Business accounts</button><button className="nav-item" onClick={() => window.history.pushState({}, '', '/admin/subscriptions/')}><span className="nav-icon">KES</span>Subscriptions</button><button className="nav-item active" onClick={() => undefined}><span className="nav-icon">⚙</span>Platform settings</button><button className="nav-item" onClick={() => window.history.pushState({}, '', '/signin/')}><span className="nav-icon">↪</span>Sign out</button></nav></aside><main className="main-content"><header className="topbar"><div className="breadcrumbs"><span>Admin portal</span><b>/</b><strong>Platform settings</strong></div></header><div className="page-content"><PageHeading eyebrow="SITE ADMIN / SETTINGS" title="App configuration" subtitle="Set the public platform identity and default account setup rules." /><article className="panel member-form"><div className="form-grid"><label><span>Platform name</span><input value={platformName} onChange={(event) => setPlatformName(event.target.value)} /></label><label><span>Support email</span><input type="email" value={supportEmail} onChange={(event) => setSupportEmail(event.target.value)} /></label><label><span>Default plan</span><select value={defaultPlan} onChange={(event) => setDefaultPlan(event.target.value)}><option>Starter</option><option>Growth</option><option>Scale</option></select></label><label><span>Maintenance mode</span><input type="checkbox" checked={maintenanceMode} onChange={(event) => setMaintenanceMode(event.target.checked)} /></label></div><div className="form-actions"><button type="button" className="secondary-button" onClick={onBack}>Back</button><button type="button" className="primary-button" onClick={save}>Save settings</button></div></article></div></main></div>
}

export default App