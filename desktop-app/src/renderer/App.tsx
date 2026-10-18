import { useEffect, useRef, useState } from 'react'
import { AudioLines, Check, ExternalLink, LogOut, Maximize2, Minimize2, Minus, Radio, RefreshCcw, Settings2, Trash2, Waves, Wifi, WifiOff, X } from 'lucide-react'
import atlasLogo from '../../../atlas-logo.png'

type Section = 'Radio Desk' | 'Audio Setup'
type Department = 'Police' | 'Sheriff' | 'Fire / EMS' | 'DOT'
type PhrasePreset = { id: string; label: string; text: string }
type AudioOutputChooser = MediaDevices & { selectAudioOutput?: () => Promise<MediaDeviceInfo> }
type RoutableAudio = HTMLAudioElement & { setSinkId?: (deviceId: string) => Promise<void> }

const DEFAULT_PRESETS: Record<Department, PhrasePreset[]> = {
  Police: [
    { id: 'police-traffic', label: 'Traffic stop', text: 'Dispatch, show me out on a traffic stop.' },
    { id: 'police-available', label: '10-8 · Available', text: 'Dispatch, show me 10-8 and available for calls.' },
    { id: 'police-responding', label: 'Responding', text: 'Dispatch, I am responding code 2.' },
    { id: 'police-scene', label: 'On scene', text: 'Dispatch, show me on scene.' },
    { id: 'police-need-unit', label: 'Request backup', text: 'Dispatch, send me another unit for backup.' },
    { id: 'police-clear', label: 'Clear call', text: 'Dispatch, I am clear from the call and back in service.' },
  ],
  Sheriff: [
    { id: 'sheriff-traffic', label: 'Traffic stop', text: 'Sheriff dispatch, I am out on a traffic stop.' },
    { id: 'sheriff-available', label: 'Available', text: 'Sheriff dispatch, I am available for calls.' },
    { id: 'sheriff-responding', label: 'Responding', text: 'Sheriff dispatch, responding to the call.' },
    { id: 'sheriff-scene', label: 'On scene', text: 'Sheriff dispatch, I am on scene.' },
    { id: 'sheriff-backup', label: 'Request backup', text: 'Sheriff dispatch, I need another deputy for backup.' },
    { id: 'sheriff-clear', label: 'Clear call', text: 'Sheriff dispatch, call is clear. I am back in service.' },
  ],
  'Fire / EMS': [
    { id: 'fire-responding', label: 'Responding', text: 'Fire dispatch, responding to the call.' },
    { id: 'fire-scene', label: 'On scene', text: 'Fire dispatch, we are on scene.' },
    { id: 'fire-transport', label: 'Transporting', text: 'Fire dispatch, transporting one patient to the hospital.' },
    { id: 'fire-clear', label: 'Available', text: 'Fire dispatch, we are clear and available.' },
    { id: 'fire-needs-unit', label: 'Request unit', text: 'Fire dispatch, please send an additional unit.' },
    { id: 'fire-hazard', label: 'Hazard report', text: 'Fire dispatch, we have a hazard at this location.' },
  ],
  DOT: [
    { id: 'dot-responding', label: 'Responding', text: 'DOT dispatch, responding to the reported road hazard.' },
    { id: 'dot-scene', label: 'On scene', text: 'DOT dispatch, I am on scene.' },
    { id: 'dot-lane', label: 'Lane closure', text: 'DOT dispatch, one lane is closed. Please use caution.' },
    { id: 'dot-clear', label: 'Road clear', text: 'DOT dispatch, the roadway is clear and open.' },
    { id: 'dot-assist', label: 'Request assistance', text: 'DOT dispatch, I need an additional unit for traffic control.' },
    { id: 'dot-available', label: 'Available', text: 'DOT dispatch, I am clear and available.' },
  ],
}

const CUSTOM_PRESETS_KEY = 'atlas-desktop-custom-radio-presets-v1'
const VOICE_STYLE_KEY = 'atlas-desktop-voice-style-v1'
const VOICE_STYLES = {
  Natural: { rate: 0, pitch: 0 },
  Dispatch: { rate: -1, pitch: -2 },
  Calm: { rate: -2, pitch: 1 },
  Urgent: { rate: 2, pitch: 2 },
  Custom: null,
} as const

function App() {
  const [section, setSection] = useState<Section>('Radio Desk')
  const [text, setText] = useState('')
  const [department, setDepartment] = useState<Department>('Police')
  const [customPresets, setCustomPresets] = useState<PhrasePreset[]>(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(CUSTOM_PRESETS_KEY) || '[]')
      return Array.isArray(saved) ? saved.filter((preset): preset is PhrasePreset =>
        typeof preset?.id === 'string' && typeof preset?.label === 'string' && typeof preset?.text === 'string'
      ).slice(0, 24) : []
    } catch { return [] }
  })
  const [callsign, setCallsign] = useState('')
  const [includeCallsign, setIncludeCallsign] = useState(false)
  const [sayOver, setSayOver] = useState(false)
  const [presetLabel, setPresetLabel] = useState('')
  const [outputDevice, setOutputDevice] = useState<MediaDeviceInfo | null>(null)
  const [outputConnected, setOutputConnected] = useState(false)
  const [voices, setVoices] = useState<string[]>([])
  const [voice, setVoice] = useState('')
  const [voiceStyle, setVoiceStyle] = useState<keyof typeof VOICE_STYLES>('Natural')
  const [voiceRate, setVoiceRate] = useState(0)
  const [voicePitch, setVoicePitch] = useState(0)
  const [internetStatus, setInternetStatus] = useState<'checking' | 'online' | 'offline'>('checking')
  const [voiceRefreshBusy, setVoiceRefreshBusy] = useState(false)
  const [windowMaximized, setWindowMaximized] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [speechStatus, setSpeechStatus] = useState('Choose the virtual cable as Atlas output and Discord input.')
  const [discordProfile, setDiscordProfile] = useState<DiscordProfile | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [authBusy, setAuthBusy] = useState(false)
  const [authMessage, setAuthMessage] = useState('')
  const holdActive = useRef(false)
  const pushSession = useRef(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioUrlRef = useRef<string | null>(null)

  useEffect(() => {
    localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(customPresets))
  }, [customPresets])

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(VOICE_STYLE_KEY) || '{}') as { voiceStyle?: keyof typeof VOICE_STYLES; rate?: number; pitch?: number }
      if (saved.voiceStyle && saved.voiceStyle in VOICE_STYLES) setVoiceStyle(saved.voiceStyle)
      if (Number.isInteger(saved.rate) && saved.rate! >= -10 && saved.rate! <= 10) setVoiceRate(saved.rate!)
      if (Number.isInteger(saved.pitch) && saved.pitch! >= -10 && saved.pitch! <= 10) setVoicePitch(saved.pitch!)
    } catch { /* Use the natural voice defaults. */ }
  }, [])

  useEffect(() => {
    localStorage.setItem(VOICE_STYLE_KEY, JSON.stringify({ voiceStyle, rate: voiceRate, pitch: voicePitch }))
  }, [voiceStyle, voiceRate, voicePitch])

  useEffect(() => {
    const unsubscribe = window.atlasDesktop.onWindowStateChanged(setWindowMaximized)
    window.atlasDesktop.getWindowState().then(setWindowMaximized).catch(() => undefined)
    return unsubscribe
  }, [])

  useEffect(() => {
    let mounted = true
    let checking = false
    const checkInternet = async () => {
      if (checking) return
      checking = true
      try {
        const connected = await window.atlasDesktop.checkInternet()
        if (mounted) setInternetStatus(connected ? 'online' : 'offline')
      } catch {
        if (mounted) setInternetStatus('offline')
      } finally { checking = false }
    }
    const onNetworkChange = () => { void checkInternet() }
    void checkInternet()
    const timer = window.setInterval(checkInternet, 15000)
    window.addEventListener('online', onNetworkChange)
    window.addEventListener('offline', onNetworkChange)
    return () => {
      mounted = false
      window.clearInterval(timer)
      window.removeEventListener('online', onNetworkChange)
      window.removeEventListener('offline', onNetworkChange)
    }
  }, [])

  useEffect(() => {
    let mounted = true
    const unsubscribe = window.atlasDesktop.onDiscordAuthResult(result => {
      if (!mounted) return
      setAuthBusy(false)
      if ('profile' in result) {
        setDiscordProfile(result.profile)
        setAuthReady(true)
        setAuthMessage('Discord account connected.')
      } else {
        setAuthMessage(result.error)
      }
    })
    return () => { mounted = false; unsubscribe() }
  }, [])

  useEffect(() => {
    if (internetStatus !== 'online') return
    let mounted = true
    setAuthReady(false)
    window.atlasDesktop.getDiscordProfile().then(profile => {
      if (mounted) {
        setDiscordProfile(profile)
        setAuthReady(true)
        if (profile) setAuthMessage('')
      }
    }).catch(() => {
      if (mounted) {
        setAuthMessage('Could not verify your Discord session. Check your connection and try again.')
        setAuthReady(true)
      }
    })
    return () => { mounted = false }
  }, [internetStatus])

  useEffect(() => {
    let mounted = true
    window.atlasDesktop.listVoices().then(installed => {
      if (!mounted) return
      setVoices(installed)
      setVoice(installed[0] || '')
    }).catch(error => {
      if (mounted) setSpeechStatus(error instanceof Error ? error.message : 'Could not load Windows voices.')
    })

    const refreshOutputs = async () => {
      const selected = outputDevice
      if (!selected) return
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const current = devices.find(device => device.kind === 'audiooutput' && device.deviceId === selected.deviceId)
        if (current) {
          setOutputDevice(current)
          setOutputConnected(true)
          setSpeechStatus(`Output connected: ${current.label || 'selected device'}.`)
        } else {
          holdActive.current = false
          pushSession.current += 1
          audioRef.current?.pause()
          setSpeaking(false)
          setOutputConnected(false)
          setSpeechStatus('Audio output disconnected. Reconnect it, then choose the output again.')
        }
      } catch {
        setOutputConnected(false)
        setSpeechStatus('Could not check audio output. Choose the output again to reconnect.')
      }
    }
    navigator.mediaDevices.addEventListener('devicechange', refreshOutputs)
    window.addEventListener('blur', endPushToTalk)
    const cancelOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') endPushToTalk() }
    window.addEventListener('keydown', cancelOnEscape)
    return () => {
      mounted = false
      navigator.mediaDevices.removeEventListener('devicechange', refreshOutputs)
      window.removeEventListener('blur', endPushToTalk)
      window.removeEventListener('keydown', cancelOnEscape)
      holdActive.current = false
      pushSession.current += 1
      audioRef.current?.pause()
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
    }
  }, [outputDevice])

  async function chooseOutput() {
    const chooser = navigator.mediaDevices as AudioOutputChooser
    if (!chooser.selectAudioOutput) {
      setSpeechStatus('This Windows audio picker is not available. Update Atlas or choose the output device in Windows sound settings.')
      return
    }
    try {
      const device = await chooser.selectAudioOutput()
      setOutputDevice(device)
      setOutputConnected(true)
      setSpeechStatus(device.label.toLowerCase().includes('cable input')
        ? 'Virtual cable selected. Select CABLE Output as your microphone in Discord.'
        : 'Output selected. Choose CABLE Input to route Atlas speech into Discord.')
    } catch {
      setSpeechStatus('No output device selected.')
    }
  }

  async function beginPushToTalk() {
    if (!text.trim() || !outputDevice || !outputConnected || !voice || holdActive.current) return
    holdActive.current = true
    const session = ++pushSession.current
    setSpeaking(true)
    setSpeechStatus(`Preparing ${voice}… Keep holding to speak.`)
    try {
      const radioStart = includeCallsign && callsign.trim() ? `${callsign.trim()}, ` : ''
      const radioEnd = sayOver ? ' Over.' : ''
      const radioText = `${radioStart}${text.trim().slice(0, Math.max(0, 500 - radioStart.length - radioEnd.length))}${radioEnd}`
      const base64 = await window.atlasDesktop.synthesizeSpeech(radioText, voice, voiceRate, voicePitch)
      if (!holdActive.current || session !== pushSession.current) {
        setSpeechStatus('Push-to-talk released. Ready when you are.')
        setSpeaking(false)
        return
      }
      const bytes = Uint8Array.from(atob(base64), character => character.charCodeAt(0))
      const source = URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }))
      audioUrlRef.current = source
      const audio = new Audio(source) as RoutableAudio
      audioRef.current = audio
      if (!audio.setSinkId) throw new Error('This version of Windows does not support choosing an audio output device.')
      await audio.setSinkId(outputDevice.deviceId)
      audio.addEventListener('ended', () => {
        holdActive.current = false
        if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
        audioUrlRef.current = null
        audioRef.current = null
        setSpeechStatus('Message finished. Hold to speak again.')
        setSpeaking(false)
      }, { once: true })
      audio.addEventListener('error', () => {
        holdActive.current = false
        if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
        audioUrlRef.current = null
        audioRef.current = null
        setSpeechStatus('Audio playback failed. Check or reconnect the selected output device.')
        setSpeaking(false)
      }, { once: true })
      await audio.play()
      setSpeechStatus(`Speaking through ${outputDevice.label || 'selected output'}… Release to stop.`)
    } catch (error) {
      if (session !== pushSession.current) return
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
      audioUrlRef.current = null
      audioRef.current = null
      holdActive.current = false
      setSpeechStatus(error instanceof Error ? error.message : 'Could not create speech.')
      setSpeaking(false)
    }
  }

  function endPushToTalk() {
    if (!holdActive.current) return
    holdActive.current = false
    pushSession.current += 1
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.currentTime = 0
      audioRef.current = null
    }
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
    audioUrlRef.current = null
    setSpeaking(false)
    setSpeechStatus('Push-to-talk released. Ready when you are.')
  }

  function addCustomPreset() {
    const label = presetLabel.trim()
    const phrase = text.trim()
    if (!label || !phrase || customPresets.length >= 24) return
    setCustomPresets(current => [...current, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, label, text: phrase }])
    setPresetLabel('')
    setSpeechStatus(`Saved “${label}” to your local radio presets.`)
  }

  async function signInWithDiscord() {
    if (internetStatus !== 'online') {
      setAuthMessage('An active internet connection is required to sign in.')
      return
    }
    setAuthBusy(true)
    setAuthMessage('Opening secure Discord sign-in…')
    try { await window.atlasDesktop.startDiscordLogin() }
    catch (error) {
      setAuthBusy(false)
      setAuthMessage(error instanceof Error ? error.message : 'Could not open Discord sign-in.')
    }
  }

  async function retryInternetCheck() {
    setInternetStatus('checking')
    try { setInternetStatus(await window.atlasDesktop.checkInternet() ? 'online' : 'offline') }
    catch { setInternetStatus('offline') }
  }

  async function refreshVoices() {
    setVoiceRefreshBusy(true)
    try {
      const installed = await window.atlasDesktop.listVoices()
      setVoices(installed)
      if (!installed.includes(voice)) setVoice(installed[0] || '')
      setSpeechStatus(installed.length ? `${installed.length} Windows speech voice${installed.length === 1 ? '' : 's'} available.` : 'No Windows speech voices are installed yet.')
    } catch (error) {
      setSpeechStatus(error instanceof Error ? error.message : 'Could not refresh Windows voices.')
    } finally { setVoiceRefreshBusy(false) }
  }

  async function openWindowsVoiceSettings() {
    try { await window.atlasDesktop.openSpeechSettings() }
    catch (error) { setSpeechStatus(error instanceof Error ? error.message : 'Could not open Windows speech settings.') }
  }

  function selectVoiceStyle(style: keyof typeof VOICE_STYLES) {
    setVoiceStyle(style)
    const preset = VOICE_STYLES[style]
    if (preset) {
      setVoiceRate(preset.rate)
      setVoicePitch(preset.pitch)
    }
  }

  async function signOutOfDiscord() {
    try {
      await window.atlasDesktop.logoutDiscord()
      setDiscordProfile(null)
      setAuthMessage('Signed out of Discord.')
    } catch {
      setAuthMessage('Could not sign out right now. Try again.')
    }
  }

  if (internetStatus !== 'online' || !authReady || !discordProfile) {
    return (
      <div className="signin-screen">
        <WindowTitleBar maximized={windowMaximized} onMaximizedChange={setWindowMaximized} />
        <div className="signin-terminal" data-faulty-terminal data-tint="#ff4a1c" aria-hidden="true" />
        <div className="signin-shade" aria-hidden="true" />
        <header className="signin-brand"><img src={atlasLogo} alt="" /><span><strong>ATLAS</strong><small>RADIO DESK</small></span><span className="signin-brand-divider" /><span className="signin-app-label">DESKTOP CLIENT</span></header>
        <main className="signin-card">
          <div className="signin-icon"><Radio size={20} /></div>
          <p className="eyebrow">YOUR RADIO STARTS HERE</p>
          <h1>{internetStatus === 'offline' ? 'Internet required' : authReady ? 'Sign in to Atlas' : 'Checking your session'}</h1>
          <p className="signin-copy">{internetStatus === 'offline' ? 'Atlas needs an active internet connection to verify your account and open the radio desk.' : internetStatus === 'checking' ? 'Checking your connection…' : !authReady ? 'Looking for your saved Discord account…' : 'Connect your Discord account to open your radio desk and manage your transmissions.'}</p>
          {authMessage && <p className="signin-feedback" role="status">{authMessage}</p>}
          {internetStatus === 'online' ? <button className="discord-login btn btn--primary" onClick={() => void signInWithDiscord()} disabled={!authReady || authBusy}><DiscordMark />{!authReady ? 'Checking Discord…' : authBusy ? 'Waiting for Discord…' : 'Continue with Discord'}</button> : <button className="discord-login btn btn--primary" onClick={() => void retryInternetCheck()} disabled={internetStatus === 'checking'}><RefreshCcw size={16} className={internetStatus === 'checking' ? 'spin' : ''} />{internetStatus === 'checking' ? 'Checking connection…' : 'Retry connection'}</button>}
          <p className={`connection-message ${internetStatus === 'online' ? 'is-online' : ''}`}>{internetStatus === 'online' ? <Wifi size={13} /> : <WifiOff size={13} />}{internetStatus === 'online' ? 'Connected to Atlas services' : internetStatus === 'checking' ? 'Verifying internet access' : 'No internet connection detected'}</p>
          <p className="signin-privacy">Your account is used for sign-in. Voice is still generated locally on this device.</p>
        </main>
        <div className="signin-footer"><span>ATLAS DESKTOP</span><span>SECURE DISCORD SIGN-IN</span></div>
      </div>
    )
  }

  return (
    <div className="app-frame">
      <WindowTitleBar maximized={windowMaximized} onMaximizedChange={setWindowMaximized} />
      <header className="appbar">
        <div className="brand"><img src={atlasLogo} alt="" /><span><strong>ATLAS</strong><small>RADIO DESK</small></span></div>
        <div className="appbar-divider" />
        <div className="appbar-context"><span className="live-dot" /> Desktop audio</div>
        <div className="appbar-spacer" />
        <span className="app-version">DESKTOP · 0.2.1</span>
      </header>

      <div className="workspace">
        <aside className="sidebar">
          <div className="sidebar-label">STUDIO</div>
          {(['Radio Desk', 'Audio Setup'] as Section[]).map(item => (
            <button key={item} className={`nav-item ${section === item ? 'active' : ''}`} onClick={() => setSection(item)}>
              <span className="nav-glyph">{item === 'Radio Desk' ? <Radio size={17} strokeWidth={1.8} /> : <Settings2 size={17} strokeWidth={1.8} />}</span>{item}
            </button>
          ))}
          <div className="sidebar-spacer" />
          <div className="account-area">
            <div className="account-label">DISCORD ACCOUNT</div>
            {discordProfile ? <div className="account-card">
              {discordProfile.avatarUrl ? <img className="account-avatar" src={discordProfile.avatarUrl} alt="" /> : <div className="account-avatar fallback-avatar">{discordProfile.username[0]?.toUpperCase() || 'D'}</div>}
              <div className="account-details"><strong>{discordProfile.globalName}</strong><small>@{discordProfile.username}</small></div>
              <button className="account-action" onClick={() => void signOutOfDiscord()} title="Sign out of Discord" aria-label="Sign out of Discord"><LogOut size={15} /></button>
            </div> : <div className="account-signin">
              <p>{authMessage || 'Sign in to show your Discord profile in Atlas.'}</p>
              <button className="discord-login btn btn--primary" onClick={() => void signInWithDiscord()} disabled={authBusy}><DiscordMark />{authBusy ? 'Waiting for Discord…' : 'Sign in with Discord'}</button>
            </div>}
            {discordProfile && authMessage && <p className="auth-message" role="status">{authMessage}</p>}
            <p className="account-footnote">Login identifies your profile. Audio still routes through your selected mic.</p>
          </div>
        </aside>

        <main className="main-content">
          <div className="page-heading">
            <div><p className="eyebrow">ATLAS DESKTOP</p><h1>{section}</h1><p className="page-description">{section === 'Radio Desk' ? 'Choose a ready-made call or write your own.' : 'Set up the audio route Atlas uses for Discord.'}</p></div>
            {section === 'Radio Desk' && <div className={`route-indicator ${outputConnected ? 'connected' : ''}`}><span />{outputConnected ? 'Audio route ready' : 'Audio route needs setup'}</div>}
          </div>

          {section === 'Radio Desk' ? <div className="desk-layout">
            <section className="panel presets-panel">
              <div className="panel-heading"><div><h2>Quick phrases</h2><p>Choose your department, then load a phrase.</p></div></div>
              <div className="department-tabs" role="tablist" aria-label="Department presets">{(Object.keys(DEFAULT_PRESETS) as Department[]).map(item => <button key={item} role="tab" aria-selected={department === item} className={department === item ? 'selected' : ''} onClick={() => setDepartment(item)}>{item}</button>)}</div>
              <div className="preset-grid">{[...DEFAULT_PRESETS[department], ...customPresets].map(preset => <div className="preset-item" key={preset.id}><button className="preset-button" title={preset.text} onClick={() => { setText(preset.text.slice(0, 500)); setSpeechStatus(`Loaded “${preset.label}”. Hold to speak when ready.`) }}><strong>{preset.label}</strong><span>{preset.text}</span></button>{customPresets.some(item => item.id === preset.id) && <button className="preset-remove" aria-label={`Delete ${preset.label}`} title="Delete custom preset" onClick={() => setCustomPresets(current => current.filter(item => item.id !== preset.id))}><Trash2 size={14} /></button>}</div>)}</div>
              <div className="radio-tools"><label className="call-sign-field"><span>UNIT / CALLSIGN</span><input value={callsign} onChange={event => setCallsign(event.target.value.slice(0, 40))} placeholder="e.g. Unit 421" maxLength={40} /></label><label className="radio-check"><input type="checkbox" checked={includeCallsign} onChange={event => setIncludeCallsign(event.target.checked)} /> Read callsign</label><label className="radio-check"><input type="checkbox" checked={sayOver} onChange={event => setSayOver(event.target.checked)} /> End with “over”</label></div>
            </section>

            <section className="panel composer-card"><div className="panel-heading"><div><h2>Compose transmission</h2><p>Speech is generated on this computer.</p></div><span className="character-count">{text.length}/500</span></div>
              <textarea value={text} onChange={event => setText(event.target.value.slice(0, 500))} placeholder="Type a message or choose a quick phrase…" maxLength={500} />
              <div className="composer-controls"><label className="voice-select"><AudioLines className="voice-icon" size={17} /><span><small>VOICE</small><select aria-label="Speech voice" value={voice} onChange={event => setVoice(event.target.value)} disabled={!voices.length}>{voices.length ? voices.map(item => <option key={item} value={item}>{item}</option>) : <option>Loading voices…</option>}</select></span></label><button className="clear-button" onClick={() => setText('')} disabled={!text}>Clear</button></div>
              <button className={`speak-button push-button ${speaking ? 'is-speaking' : ''}`} onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); void beginPushToTalk() }} onPointerUp={endPushToTalk} onPointerCancel={endPushToTalk} onLostPointerCapture={endPushToTalk} onKeyDown={event => { if (event.code === 'Space' && !event.repeat) { event.preventDefault(); void beginPushToTalk() } }} onKeyUp={event => { if (event.code === 'Space') { event.preventDefault(); endPushToTalk() } }} disabled={!text.trim() || !outputConnected || !voice}><span className="ptt-icon">{speaking ? <Waves size={16} /> : <Radio size={16} />}</span><span>{speaking ? 'TRANSMITTING · RELEASE TO STOP' : 'HOLD TO TRANSMIT'}</span><kbd>SPACE</kbd></button>
              <p className="route-status" role="status">{speechStatus}</p>
              <div className="save-preset"><input value={presetLabel} onChange={event => setPresetLabel(event.target.value.slice(0, 32))} maxLength={32} placeholder="Name this phrase" aria-label="Preset name" /><button className="outline-button btn btn--ghost btn--small" onClick={addCustomPreset} disabled={!presetLabel.trim() || !text.trim() || customPresets.length >= 24}>Save phrase</button></div>
              <p className="preset-count">{customPresets.length} of 24 personal phrases saved on this device</p>
            </section>
          </div> : <div className="settings-layout">
            <section className="panel audio-panel"><div className="panel-heading"><div><h2>Audio output</h2><p>Send Atlas speech to this playback device.</p></div><span className={`status-chip ${outputConnected ? 'is-ready' : ''}`}><i />{outputConnected ? 'READY' : outputDevice ? 'DISCONNECTED' : 'NOT SET'}</span></div>
              <div className="connection-row"><div className="audio-icon"><AudioLines size={19} /></div><div className="server-copy"><strong>{outputDevice?.label || 'No output selected'}</strong><small>For Discord, choose CABLE Input here and CABLE Output as Discord’s mic.</small></div><button className="outline-button btn btn--ghost btn--small" onClick={chooseOutput}>{outputConnected ? <><Check size={14} /> Change output</> : 'Choose output'}</button></div>
              <p className="route-status" role="status">{speechStatus}</p>
              <div className="setup-note"><strong>Virtual cable setup</strong><p>Install VB-Audio Virtual Cable separately, then restart Atlas. It is not bundled with this app.</p></div>
            </section>
            <section className="panel audio-panel"><div className="panel-heading"><div><h2>Speech voice</h2><p>Choose an installed Windows voice and shape its delivery.</p></div><button className="outline-button btn btn--ghost btn--small" onClick={() => void refreshVoices()} disabled={voiceRefreshBusy}><RefreshCcw size={14} className={voiceRefreshBusy ? 'spin' : ''} /> Refresh</button></div>
              <label className="settings-voice"><span>ACTIVE VOICE</span><select aria-label="Speech voice" value={voice} onChange={event => setVoice(event.target.value)} disabled={!voices.length}>{voices.length ? voices.map(item => <option key={item} value={item}>{item}</option>) : <option>No Windows voices found</option>}</select></label>
              <label className="settings-voice"><span>VOICE PROFILE</span><select aria-label="Voice profile" value={voiceStyle} onChange={event => selectVoiceStyle(event.target.value as keyof typeof VOICE_STYLES)}>{Object.keys(VOICE_STYLES).map(style => <option key={style}>{style}</option>)}</select></label>
              <div className="voice-tuning"><label><span>PACE <output>{voiceRate > 0 ? '+' : ''}{voiceRate}</output></span><input type="range" min="-10" max="10" step="1" value={voiceRate} onChange={event => { setVoiceRate(Number(event.target.value)); setVoiceStyle('Custom') }} /></label><label><span>PITCH <output>{voicePitch > 0 ? '+' : ''}{voicePitch}</output></span><input type="range" min="-10" max="10" step="1" value={voicePitch} onChange={event => { setVoicePitch(Number(event.target.value)); setVoiceStyle('Custom') }} /></label></div>
              <div className="voice-actions"><p>Settings are saved on this device. Install more voices in Windows, then refresh.</p><button className="outline-button btn btn--ghost btn--small" onClick={() => void openWindowsVoiceSettings()}><ExternalLink size={13} /> Add Windows voices</button></div>
            </section>
          </div>}

          <footer className="main-footer"><span>Atlas keeps your voice and phrases on this device.</span><span>Discord account required</span></footer>
        </main>
      </div>
    </div>
  )
}

function WindowTitleBar({ maximized, onMaximizedChange }: { maximized: boolean; onMaximizedChange: (maximized: boolean) => void }) {
  async function toggleMaximize() {
    try { onMaximizedChange(await window.atlasDesktop.toggleMaximizeWindow()) }
    catch { /* The window may be closing. */ }
  }

  return (
    <div className="window-titlebar" role="toolbar" aria-label="Window controls">
      <div className="window-traffic-lights">
        <button className="traffic-light close" aria-label="Close Atlas" title="Close" onClick={() => void window.atlasDesktop.closeWindow()}><X size={9} /></button>
        <button className="traffic-light minimize" aria-label="Minimize Atlas" title="Minimize" onClick={() => void window.atlasDesktop.minimizeWindow()}><Minus size={9} /></button>
        <button className="traffic-light maximize" aria-label={maximized ? 'Restore Atlas' : 'Maximize Atlas'} title={maximized ? 'Restore' : 'Maximize'} onClick={() => void toggleMaximize()}>{maximized ? <Minimize2 size={8} /> : <Maximize2 size={8} />}</button>
      </div>
      <div className="window-title"><img src={atlasLogo} alt="" /><span>Atlas</span></div>
      <div className="window-titlebar-spacer" />
    </div>
  )
}

function DiscordMark() {
  return <svg className="discord-mark" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M20.32 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.211.375-.445.865-.61 1.25a18.27 18.27 0 0 0-5.49 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.675 4.37a.07.07 0 0 0-.032.027C.533 9.08-.32 13.65.106 18.164a.083.083 0 0 0 .031.056 19.9 19.9 0 0 0 6.004 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.077.077 0 0 0-.042-.107 13.13 13.13 0 0 1-1.875-.894.078.078 0 0 1-.008-.13c.126-.094.251-.192.37-.29a.074.074 0 0 1 .077-.01c3.93 1.794 8.19 1.794 12.074 0a.074.074 0 0 1 .078.01c.12.099.245.197.372.291a.078.078 0 0 1-.007.13c-.599.35-1.228.65-1.877.893a.078.078 0 0 0-.041.108c.36.698.772 1.36 1.225 1.993a.077.077 0 0 0 .084.029 19.84 19.84 0 0 0 6.012-3.03.078.078 0 0 0 .03-.055c.51-5.216-.85-9.75-3.54-13.768a.062.062 0 0 0-.03-.027ZM8.02 14.9c-1.18 0-2.153-1.084-2.153-2.416 0-1.332.954-2.416 2.153-2.416 1.208 0 2.18 1.093 2.162 2.416 0 1.332-.954 2.416-2.162 2.416Zm7.96 0c-1.18 0-2.153-1.084-2.153-2.416 0-1.332.936-2.416 2.153-2.416 1.208 0 2.18 1.093 2.162 2.416 0 1.332-.954 2.416-2.162 2.416Z" /></svg>
}

export default App
