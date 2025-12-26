// ============================================================================
// SETTINGS PAGE
// App configuration and preferences
// ============================================================================

import { useStore } from '@/lib/store'
import { intervalsClient } from '@/lib/api/intervals-client'
import { aiClient } from '@/lib/api/ai-client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    User,
    Activity,
    Calendar,
    Link2,
    Palette,
    Save,
    CheckCircle,
    XCircle,
    Loader2,
} from 'lucide-react'
import { useState } from 'react'

type TabId = 'profile' | 'training' | 'integrations' | 'appearance'

type ConnectionStatus = 'idle' | 'testing' | 'success' | 'error'

export default function Settings() {
    const store = useStore()
    const [activeTab, setActiveTab] = useState<TabId>('profile')
    const [saved, setSaved] = useState(false)
    const [intervalsStatus, setIntervalsStatus] = useState<ConnectionStatus>('idle')
    const [intervalsError, setIntervalsError] = useState<string>('')
    const [aiStatus, setAiStatus] = useState<ConnectionStatus>('idle')
    const [aiError, setAiError] = useState<string>('')

    const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
        { id: 'profile', label: 'Profile', icon: User },
        { id: 'training', label: 'Training', icon: Activity },
        { id: 'integrations', label: 'Integrations', icon: Link2 },
        { id: 'appearance', label: 'Appearance', icon: Palette },
    ]

    const handleSave = () => {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
    }

    const testIntervalsConnection = async () => {
        if (!store.intervals.apiKey || !store.intervals.athleteId) {
            setIntervalsError('Please enter both Athlete ID and API Key')
            setIntervalsStatus('error')
            return
        }

        setIntervalsStatus('testing')
        setIntervalsError('')

        intervalsClient.setCredentials({
            apiKey: store.intervals.apiKey,
            athleteId: store.intervals.athleteId,
        })

        const result = await intervalsClient.testConnection()

        if (result.success) {
            setIntervalsStatus('success')
            console.log('[Settings] Intervals.icu connected:', result.athlete?.name)
        } else {
            setIntervalsStatus('error')
            setIntervalsError(result.error || 'Connection failed')
        }
    }

    const testAIConnection = async () => {
        if (!store.ai.apiKey) {
            setAiError('Please enter an API Key')
            setAiStatus('error')
            return
        }

        setAiStatus('testing')
        setAiError('')

        aiClient.configure({
            provider: store.ai.provider,
            apiKey: store.ai.apiKey,
        })

        try {
            const response = await aiClient.complete(
                'You are a helpful assistant.',
                'Say "Connection successful!" and nothing else.'
            )
            if (response) {
                setAiStatus('success')
                console.log('[Settings] AI connected:', response.slice(0, 50))
            }
        } catch (error) {
            setAiStatus('error')
            setAiError(error instanceof Error ? error.message : 'Connection failed')
        }
    }


    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
                    <p className="text-muted-foreground">Manage your preferences</p>
                </div>
                <Button onClick={handleSave} className="rounded-full">
                    <Save className="w-4 h-4 mr-2" />
                    {saved ? 'Saved!' : 'Save Changes'}
                </Button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2">
                {tabs.map((tab) => (
                    <Button
                        key={tab.id}
                        variant={activeTab === tab.id ? 'default' : 'outline'}
                        onClick={() => setActiveTab(tab.id)}
                        className="rounded-full whitespace-nowrap"
                    >
                        <tab.icon className="w-4 h-4 mr-2" />
                        {tab.label}
                    </Button>
                ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'profile' && (
                <Card>
                    <CardHeader>
                        <CardTitle>Athlete Profile</CardTitle>
                        <CardDescription>Your personal information and fitness details</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="name">Name</Label>
                                <Input
                                    id="name"
                                    value={store.athlete.name}
                                    onChange={(e) => store.setAthlete({ name: e.target.value })}
                                    placeholder="Your name"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="sport">Sport</Label>
                                <select
                                    id="sport"
                                    value={store.athlete.sport}
                                    onChange={(e) => store.setAthlete({ sport: e.target.value as 'Running' | 'Cycling' })}
                                    className="flex h-10 w-full rounded-xl border border-input bg-background px-4 py-2 text-sm"
                                >
                                    <option value="Running">Running</option>
                                    <option value="Cycling">Cycling</option>
                                </select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="experience">Experience Level</Label>
                                <select
                                    id="experience"
                                    value={store.athlete.experience}
                                    onChange={(e) => store.setAthlete({ experience: e.target.value as any })}
                                    className="flex h-10 w-full rounded-xl border border-input bg-background px-4 py-2 text-sm"
                                >
                                    <option value="fresh_start">Fresh Start</option>
                                    <option value="transfer">Transfer from another sport</option>
                                    <option value="consistent">Consistent training</option>
                                    <option value="high_performance">High performance</option>
                                </select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="gym">Gym Access</Label>
                                <select
                                    id="gym"
                                    value={store.athlete.gymAccess}
                                    onChange={(e) => store.setAthlete({ gymAccess: e.target.value as any })}
                                    className="flex h-10 w-full rounded-xl border border-input bg-background px-4 py-2 text-sm"
                                >
                                    <option value="none">No gym access</option>
                                    <option value="basic">Basic equipment</option>
                                    <option value="full">Full gym</option>
                                </select>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {activeTab === 'training' && (
                <Card>
                    <CardHeader>
                        <CardTitle>Training Settings</CardTitle>
                        <CardDescription>Customize your training plan parameters</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="startVolume">Starting Weekly Volume (km)</Label>
                                <Input
                                    id="startVolume"
                                    type="number"
                                    value={store.progression.startingVolume}
                                    onChange={(e) => store.setProgression({ startingVolume: Number(e.target.value) })}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="startLongRun">Starting Long Run (km)</Label>
                                <Input
                                    id="startLongRun"
                                    type="number"
                                    value={store.progression.startingLongRun}
                                    onChange={(e) => store.setProgression({ startingLongRun: Number(e.target.value) })}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="progressionRate">Weekly Progression Rate (%)</Label>
                                <Input
                                    id="progressionRate"
                                    type="number"
                                    value={Math.round(store.progression.progressionRate * 100)}
                                    onChange={(e) => store.setProgression({ progressionRate: Number(e.target.value) / 100 })}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="longRunProgression">Long Run Weekly Increase (km)</Label>
                                <Input
                                    id="longRunProgression"
                                    type="number"
                                    step="0.5"
                                    value={store.progression.longRunProgression}
                                    onChange={(e) => store.setProgression({ longRunProgression: Number(e.target.value) })}
                                />
                            </div>
                        </div>

                        {/* Goal Settings */}
                        <div className="pt-6 border-t">
                            <h3 className="font-semibold mb-4">Goal</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label htmlFor="raceDate">Race Date</Label>
                                    <Input
                                        id="raceDate"
                                        type="date"
                                        value={store.goal.raceDate || ''}
                                        onChange={(e) => store.setGoal({ raceDate: e.target.value })}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="raceType">Race Type</Label>
                                    <select
                                        id="raceType"
                                        value={store.goal.raceType || ''}
                                        onChange={(e) => store.setGoal({ raceType: e.target.value as any })}
                                        className="flex h-10 w-full rounded-xl border border-input bg-background px-4 py-2 text-sm"
                                    >
                                        <option value="">Select race type</option>
                                        <option value="Marathon">Marathon</option>
                                        <option value="Half Marathon">Half Marathon</option>
                                        <option value="10K">10K</option>
                                        <option value="5K">5K</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {activeTab === 'integrations' && (
                <Card>
                    <CardHeader>
                        <CardTitle>Integrations</CardTitle>
                        <CardDescription>Connect to external services</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Intervals.icu */}
                        <div className="p-4 rounded-xl border space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                                    <Calendar className="w-5 h-5 text-blue-600" />
                                </div>
                                <div>
                                    <h4 className="font-semibold">Intervals.icu</h4>
                                    <p className="text-sm text-muted-foreground">Sync your training plan</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="intervalsId">Athlete ID</Label>
                                    <Input
                                        id="intervalsId"
                                        value={store.intervals.athleteId}
                                        onChange={(e) => store.setIntervalsCredentials({ athleteId: e.target.value })}
                                        placeholder="i12345"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="intervalsKey">API Key</Label>
                                    <Input
                                        id="intervalsKey"
                                        type="password"
                                        value={store.intervals.apiKey}
                                        onChange={(e) => store.setIntervalsCredentials({ apiKey: e.target.value })}
                                        placeholder="Your API key"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <Button
                                    variant="outline"
                                    className="rounded-full"
                                    onClick={testIntervalsConnection}
                                    disabled={intervalsStatus === 'testing'}
                                >
                                    {intervalsStatus === 'testing' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                    {intervalsStatus === 'success' && <CheckCircle className="w-4 h-4 mr-2 text-green-500" />}
                                    {intervalsStatus === 'error' && <XCircle className="w-4 h-4 mr-2 text-red-500" />}
                                    Test Connection
                                </Button>
                                {intervalsStatus === 'success' && (
                                    <span className="text-sm text-green-600">Connected!</span>
                                )}
                                {intervalsError && (
                                    <span className="text-sm text-red-500">{intervalsError}</span>
                                )}
                            </div>
                        </div>

                        {/* AI Provider */}
                        <div className="p-4 rounded-xl border space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                                    <Activity className="w-5 h-5 text-purple-600" />
                                </div>
                                <div>
                                    <h4 className="font-semibold">AI Provider</h4>
                                    <p className="text-sm text-muted-foreground">For intelligent plan adjustments</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="aiProvider">Provider</Label>
                                    <select
                                        id="aiProvider"
                                        value={store.ai.provider}
                                        onChange={(e) => store.setAIConfig({ provider: e.target.value as any })}
                                        className="flex h-10 w-full rounded-xl border border-input bg-background px-4 py-2 text-sm"
                                    >
                                        <option value="mistral">Mistral AI</option>
                                        <option value="gemini">Google Gemini</option>
                                        <option value="openrouter">OpenRouter</option>
                                        <option value="deepseek">DeepSeek</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="aiKey">API Key</Label>
                                    <Input
                                        id="aiKey"
                                        type="password"
                                        value={store.ai.apiKey}
                                        onChange={(e) => store.setAIConfig({ apiKey: e.target.value })}
                                        placeholder="Your API key"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <Button
                                    variant="outline"
                                    className="rounded-full"
                                    onClick={testAIConnection}
                                    disabled={aiStatus === 'testing'}
                                >
                                    {aiStatus === 'testing' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                    {aiStatus === 'success' && <CheckCircle className="w-4 h-4 mr-2 text-green-500" />}
                                    {aiStatus === 'error' && <XCircle className="w-4 h-4 mr-2 text-red-500" />}
                                    Test AI
                                </Button>
                                {aiStatus === 'success' && (
                                    <span className="text-sm text-green-600">Connected!</span>
                                )}
                                {aiError && (
                                    <span className="text-sm text-red-500">{aiError}</span>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {activeTab === 'appearance' && (
                <Card>
                    <CardHeader>
                        <CardTitle>Appearance</CardTitle>
                        <CardDescription>Customize how the app looks</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 rounded-xl border">
                                <div>
                                    <h4 className="font-semibold">Dark Mode</h4>
                                    <p className="text-sm text-muted-foreground">Toggle dark theme</p>
                                </div>
                                <Button
                                    variant="outline"
                                    onClick={() => document.documentElement.classList.toggle('dark')}
                                >
                                    Toggle
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
