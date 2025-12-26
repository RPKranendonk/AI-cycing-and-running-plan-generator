// ============================================================================
// ONBOARDING PAGE
// Enhanced wizard with slider-based availability and step progress
// ============================================================================

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import {
    Zap,
    ChevronRight,
    ChevronLeft,
    PersonStanding,
    Bike,
    Dumbbell,
    Check,
    Copy,
    Home,
    User,
} from 'lucide-react';

type Step = 'welcome' | 'sport' | 'experience' | 'goal' | 'availability' | 'gym' | 'complete';

const STEPS: Step[] = ['welcome', 'sport', 'experience', 'goal', 'availability', 'gym', 'complete'];
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function Onboarding() {
    const navigate = useNavigate();
    const store = useStore();
    const [step, setStep] = useState<Step>('welcome');
    const [name, setName] = useState(store.athlete.name);
    const [dailyHours, setDailyHours] = useState([1, 1, 1, 1, 1, 2, 2]); // Mon-Sun

    const currentIndex = STEPS.indexOf(step);

    const next = () => {
        const idx = STEPS.indexOf(step);
        if (idx < STEPS.length - 1) {
            setStep(STEPS[idx + 1]);
        }
    };

    const back = () => {
        const idx = STEPS.indexOf(step);
        if (idx > 0) {
            setStep(STEPS[idx - 1]);
        }
    };

    const handleComplete = () => {
        // Save availability to store
        store.setAllAvailability({
            0: { hours: dailyHours[6], split: false, amHours: dailyHours[6], pmHours: 0 }, // Sunday
            1: { hours: dailyHours[0], split: false, amHours: dailyHours[0], pmHours: 0 }, // Monday
            2: { hours: dailyHours[1], split: false, amHours: dailyHours[1], pmHours: 0 }, // Tuesday
            3: { hours: dailyHours[2], split: false, amHours: dailyHours[2], pmHours: 0 }, // Wednesday
            4: { hours: dailyHours[3], split: false, amHours: dailyHours[3], pmHours: 0 }, // Thursday
            5: { hours: dailyHours[4], split: false, amHours: dailyHours[4], pmHours: 0 }, // Friday
            6: { hours: dailyHours[5], split: false, amHours: dailyHours[5], pmHours: 0 }, // Saturday
        });
        store.setAthlete({ name });
        navigate('/');
    };

    const copyMondayToWeek = () => {
        const mondayHours = dailyHours[0];
        setDailyHours([mondayHours, mondayHours, mondayHours, mondayHours, mondayHours, dailyHours[5], dailyHours[6]]);
    };

    const totalWeeklyHours = dailyHours.reduce((a, b) => a + b, 0);

    return (
        <div className="min-h-screen bg-gradient-to-br from-background to-secondary/30 flex items-center justify-center p-4">
            <div className="w-full max-w-lg">
                {/* Progress Steps */}
                <div className="mb-8 flex justify-center gap-2 px-4">
                    {STEPS.map((s, i) => (
                        <div
                            key={s}
                            className={cn(
                                "h-1 flex-1 rounded-full transition-all duration-500",
                                i <= currentIndex ? "bg-primary" : "bg-border"
                            )}
                        />
                    ))}
                </div>

                <Card className="shadow-xl border-none">
                    <CardContent className="p-8">
                        {/* Welcome Step */}
                        {step === 'welcome' && (
                            <div className="text-center space-y-6">
                                <div className="w-20 h-20 rounded-2xl bg-primary flex items-center justify-center mx-auto">
                                    <Zap className="w-10 h-10 text-primary-foreground" />
                                </div>
                                <div>
                                    <h1 className="text-3xl font-bold mb-2">Welcome to Endurance AI</h1>
                                    <p className="text-muted-foreground">
                                        Let's set up your personalized training plan in just a few steps.
                                    </p>
                                </div>
                                <div className="space-y-4">
                                    <Input
                                        placeholder="What's your name?"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="text-center text-lg h-14"
                                    />
                                    <Button
                                        onClick={next}
                                        disabled={!name.trim()}
                                        className="w-full h-14 rounded-full text-lg"
                                    >
                                        Get Started
                                        <ChevronRight className="w-5 h-5 ml-2" />
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Sport Selection Step */}
                        {step === 'sport' && (
                            <div className="space-y-6">
                                <div className="text-center">
                                    <h2 className="text-2xl font-bold mb-2">What moves you?</h2>
                                    <p className="text-muted-foreground">Choose your primary focus</p>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    {[
                                        { id: 'Running', icon: PersonStanding, label: 'Running', desc: '5K to Marathon' },
                                        { id: 'Cycling', icon: Bike, label: 'Cycling', desc: 'Road & Gravel' },
                                    ].map((sport) => (
                                        <button
                                            key={sport.id}
                                            onClick={() => {
                                                store.setAthlete({ sport: sport.id as 'Running' | 'Cycling' });
                                                next();
                                            }}
                                            className={cn(
                                                "p-6 rounded-2xl border-2 transition-all hover:scale-[1.02]",
                                                store.athlete.sport === sport.id
                                                    ? 'border-primary bg-primary/5 shadow-md'
                                                    : 'border-transparent bg-white shadow-sm hover:shadow-md'
                                            )}
                                        >
                                            <sport.icon className="w-12 h-12 mx-auto mb-3 text-primary" />
                                            <p className="font-semibold">{sport.label}</p>
                                            <p className="text-xs text-muted-foreground">{sport.desc}</p>
                                        </button>
                                    ))}
                                </div>
                                <Button variant="ghost" onClick={back} className="w-full">
                                    <ChevronLeft className="w-4 h-4 mr-2" />
                                    Back
                                </Button>
                            </div>
                        )}

                        {/* Experience Step */}
                        {step === 'experience' && (
                            <div className="space-y-6">
                                <div className="text-center">
                                    <h2 className="text-2xl font-bold mb-2">Your Experience</h2>
                                    <p className="text-muted-foreground">Select your current level</p>
                                </div>
                                <div className="space-y-3">
                                    {[
                                        { id: 'fresh_start', label: 'Beginner', desc: '0–15 km/week' },
                                        { id: 'transfer', label: 'Intermediate', desc: '15–40 km/week' },
                                        { id: 'consistent', label: 'Advanced', desc: '40–70 km/week' },
                                        { id: 'high_performance', label: 'Elite', desc: '70+ km/week' },
                                    ].map((exp) => (
                                        <button
                                            key={exp.id}
                                            onClick={() => {
                                                store.setAthlete({ experience: exp.id as any });
                                                next();
                                            }}
                                            className={cn(
                                                "w-full p-4 rounded-2xl border-2 text-left transition-all hover:scale-[1.01]",
                                                store.athlete.experience === exp.id
                                                    ? 'border-primary bg-primary/5 shadow-md'
                                                    : 'border-transparent bg-white shadow-sm hover:shadow-md'
                                            )}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="font-semibold">{exp.label}</p>
                                                    <p className="text-sm text-muted-foreground">{exp.desc}</p>
                                                </div>
                                                {store.athlete.experience === exp.id && (
                                                    <Check className="w-5 h-5 text-primary" />
                                                )}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                                <Button variant="ghost" onClick={back} className="w-full">
                                    <ChevronLeft className="w-4 h-4 mr-2" />
                                    Back
                                </Button>
                            </div>
                        )}

                        {/* Goal Step */}
                        {step === 'goal' && (
                            <div className="space-y-6">
                                <div className="text-center">
                                    <h2 className="text-2xl font-bold mb-2">Set Your Goal</h2>
                                    <p className="text-muted-foreground">We'll optimize your plan to peak on race day</p>
                                </div>
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Race Type</label>
                                        <select
                                            value={store.goal.raceType || ''}
                                            onChange={(e) => store.setGoal({ raceType: e.target.value as any, type: 'event' })}
                                            className="w-full h-12 rounded-xl border border-input bg-background px-4"
                                        >
                                            <option value="">Select race type</option>
                                            <option value="Marathon">Marathon</option>
                                            <option value="Half Marathon">Half Marathon</option>
                                            <option value="10K">10K</option>
                                            <option value="5K">5K</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Race Date</label>
                                        <Input
                                            type="date"
                                            value={store.goal.raceDate || ''}
                                            onChange={(e) => store.setGoal({ raceDate: e.target.value })}
                                            className="h-12"
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <Button variant="outline" onClick={back} className="flex-1 rounded-full">
                                        <ChevronLeft className="w-4 h-4 mr-2" />
                                        Back
                                    </Button>
                                    <Button onClick={next} className="flex-1 rounded-full">
                                        Continue
                                        <ChevronRight className="w-4 h-4 ml-2" />
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Availability Step - Enhanced with Sliders */}
                        {step === 'availability' && (
                            <div className="space-y-6">
                                <div className="text-center">
                                    <h2 className="text-2xl font-bold mb-2">Weekly Schedule</h2>
                                    <p className="text-muted-foreground">Set your daily training capacity (hours)</p>
                                </div>

                                {/* Total Summary */}
                                <div className="text-center p-4 rounded-2xl bg-primary/10">
                                    <p className="text-sm text-muted-foreground">Total Weekly</p>
                                    <p className="text-3xl font-bold text-primary">{totalWeeklyHours}h</p>
                                </div>

                                <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-2">
                                    {DAY_NAMES.map((day, i) => (
                                        <div key={day} className="bg-white p-4 rounded-2xl shadow-sm border space-y-3">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center font-bold text-sm">
                                                        {day}
                                                    </div>
                                                    <span className="font-medium">{dailyHours[i]}h</span>
                                                </div>
                                            </div>
                                            <Slider
                                                min={0}
                                                max={4}
                                                step={0.5}
                                                value={[dailyHours[i]]}
                                                onValueChange={(val) => {
                                                    const newHours = [...dailyHours];
                                                    newHours[i] = val[0];
                                                    setDailyHours(newHours);
                                                }}
                                            />
                                        </div>
                                    ))}
                                </div>

                                <Button
                                    variant="outline"
                                    onClick={copyMondayToWeek}
                                    className="w-full rounded-full"
                                >
                                    <Copy className="w-4 h-4 mr-2" />
                                    Copy Monday to Weekdays
                                </Button>

                                <div className="flex gap-3">
                                    <Button variant="outline" onClick={back} className="flex-1 rounded-full">
                                        Back
                                    </Button>
                                    <Button onClick={next} className="flex-1 rounded-full">
                                        Continue
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Gym Access Step */}
                        {step === 'gym' && (
                            <div className="space-y-6">
                                <div className="text-center">
                                    <h2 className="text-2xl font-bold mb-2">Gym Access?</h2>
                                    <p className="text-muted-foreground">We'll tailor strength training to your equipment</p>
                                </div>
                                <div className="space-y-3">
                                    {[
                                        { id: 'full', icon: Dumbbell, label: 'Commercial Gym', desc: 'Full equipment access' },
                                        { id: 'basic', icon: Home, label: 'Home Setup', desc: 'Basic weights & bench' },
                                        { id: 'none', icon: User, label: 'Bodyweight Only', desc: 'No equipment needed' },
                                    ].map((gym) => (
                                        <button
                                            key={gym.id}
                                            onClick={() => {
                                                store.setAthlete({ gymAccess: gym.id as any });
                                                next();
                                            }}
                                            className={cn(
                                                "w-full p-4 rounded-2xl border-2 transition-all hover:scale-[1.01] flex items-center gap-4",
                                                store.athlete.gymAccess === gym.id
                                                    ? 'border-primary bg-primary/5 shadow-md'
                                                    : 'border-transparent bg-white shadow-sm hover:shadow-md'
                                            )}
                                        >
                                            <div className={cn(
                                                "w-12 h-12 rounded-full flex items-center justify-center",
                                                store.athlete.gymAccess === gym.id ? "bg-primary text-white" : "bg-gray-100 text-gray-500"
                                            )}>
                                                <gym.icon className="w-6 h-6" />
                                            </div>
                                            <div className="text-left flex-1">
                                                <p className="font-semibold">{gym.label}</p>
                                                <p className="text-sm text-muted-foreground">{gym.desc}</p>
                                            </div>
                                            {store.athlete.gymAccess === gym.id && (
                                                <Check className="w-5 h-5 text-primary" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                                <Button variant="ghost" onClick={back} className="w-full">
                                    <ChevronLeft className="w-4 h-4 mr-2" />
                                    Back
                                </Button>
                            </div>
                        )}

                        {/* Complete Step */}
                        {step === 'complete' && (
                            <div className="text-center space-y-6">
                                <div className="w-20 h-20 rounded-2xl bg-green-500 flex items-center justify-center mx-auto">
                                    <Check className="w-10 h-10 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold mb-2">You're All Set, {name}!</h2>
                                    <p className="text-muted-foreground">
                                        Your personalized training plan is ready.
                                    </p>
                                </div>
                                <div className="grid grid-cols-2 gap-3 text-left">
                                    <div className="p-3 rounded-xl bg-secondary/50">
                                        <p className="text-xs text-muted-foreground uppercase font-bold">Sport</p>
                                        <p className="font-semibold">{store.athlete.sport}</p>
                                    </div>
                                    <div className="p-3 rounded-xl bg-secondary/50">
                                        <p className="text-xs text-muted-foreground uppercase font-bold">Level</p>
                                        <p className="font-semibold">{store.athlete.experience}</p>
                                    </div>
                                    <div className="p-3 rounded-xl bg-secondary/50">
                                        <p className="text-xs text-muted-foreground uppercase font-bold">Goal</p>
                                        <p className="font-semibold">{store.goal.raceType || 'General'}</p>
                                    </div>
                                    <div className="p-3 rounded-xl bg-secondary/50">
                                        <p className="text-xs text-muted-foreground uppercase font-bold">Weekly</p>
                                        <p className="font-semibold">{totalWeeklyHours}h</p>
                                    </div>
                                </div>
                                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                                    Data stored locally on your device.
                                </div>
                                <Button
                                    onClick={handleComplete}
                                    className="w-full h-14 rounded-full text-lg"
                                >
                                    Go to Dashboard
                                    <ChevronRight className="w-5 h-5 ml-2" />
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Skip link */}
                <div className="mt-4 text-center">
                    <button
                        onClick={handleComplete}
                        className="text-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                        Skip for now
                    </button>
                </div>
            </div>
        </div>
    );
}
