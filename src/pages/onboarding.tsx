// ============================================================================
// ONBOARDING PAGE
// Full 9-step wizard based on _DESIGN_REFERENCE
// ============================================================================

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Calendar } from '@/components/ui/calendar';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Activity, Bike, Heart, Trophy, Flame,
    Dumbbell, Home, User, Check, Copy,
    ChevronRight, ChevronLeft,
} from 'lucide-react';

const STEPS = ['Activity', 'Experience', 'Goal', 'Date', 'Threshold', 'Schedule', 'Plan Start', 'Gym', 'Summary'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function Onboarding() {
    const navigate = useNavigate();
    const store = useStore();
    const [step, setStep] = useState(0);
    const [direction, setDirection] = useState(1);

    const [formData, setFormData] = useState({
        sport: store.athlete.sport || '',
        level: store.athlete.experience || '',
        goal: '',
        goalDate: undefined as Date | undefined,
        planStartDate: undefined as Date | undefined,
        thresholdPace: { min: '5', sec: '00' },
        availability: [1, 1, 1, 1, 1, 2, 2],
        availabilitySplit: [false, false, false, false, false, false, false],
        availabilityAM: [0.5, 0.5, 0.5, 0.5, 0.5, 1, 1],
        availabilityPM: [0.5, 0.5, 0.5, 0.5, 0.5, 1, 1],
        gymAccess: store.athlete.gymAccess || '',
    });

    const nextStep = () => {
        if (step < STEPS.length - 1) {
            setDirection(1);
            setStep(step + 1);
        } else {
            handleComplete();
        }
    };

    const prevStep = () => {
        if (step > 0) {
            setDirection(-1);
            setStep(step - 1);
        }
    };

    const handleComplete = () => {
        // Save to store
        store.setAthlete({
            sport: formData.sport as 'Running' | 'Cycling',
            experience: formData.level as any,
            gymAccess: formData.gymAccess as any,
        });

        // Convert availability to store format
        store.setAllAvailability({
            0: { hours: formData.availability[6], split: formData.availabilitySplit[6], amHours: formData.availabilityAM[6], pmHours: formData.availabilityPM[6] },
            1: { hours: formData.availability[0], split: formData.availabilitySplit[0], amHours: formData.availabilityAM[0], pmHours: formData.availabilityPM[0] },
            2: { hours: formData.availability[1], split: formData.availabilitySplit[1], amHours: formData.availabilityAM[1], pmHours: formData.availabilityPM[1] },
            3: { hours: formData.availability[2], split: formData.availabilitySplit[2], amHours: formData.availabilityAM[2], pmHours: formData.availabilityPM[2] },
            4: { hours: formData.availability[3], split: formData.availabilitySplit[3], amHours: formData.availabilityAM[3], pmHours: formData.availabilityPM[3] },
            5: { hours: formData.availability[4], split: formData.availabilitySplit[4], amHours: formData.availabilityAM[4], pmHours: formData.availabilityPM[4] },
            6: { hours: formData.availability[5], split: formData.availabilitySplit[5], amHours: formData.availabilityAM[5], pmHours: formData.availabilityPM[5] },
        });

        if (formData.goalDate) {
            store.setGoal({ raceDate: formData.goalDate.toISOString().split('T')[0], type: 'event' });
        }

        navigate('/');
    };

    const updateData = (key: string, value: unknown) => {
        setFormData(prev => ({ ...prev, [key]: value }));
    };

    const variants = {
        enter: (direction: number) => ({ x: direction > 0 ? 50 : -50, opacity: 0 }),
        center: { x: 0, opacity: 1 },
        exit: (direction: number) => ({ x: direction > 0 ? -50 : 50, opacity: 0 }),
    };

    const totalHours = formData.availability.reduce((a, b) => a + b, 0);

    return (
        <div className="min-h-screen bg-gradient-to-br from-background to-secondary/30 flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* Progress Bars */}
            <div className="absolute top-8 left-0 right-0 flex justify-center gap-2 px-8 max-w-md mx-auto">
                {STEPS.map((_, i) => (
                    <div
                        key={i}
                        className={cn(
                            "h-1 flex-1 rounded-full transition-all duration-500",
                            i <= step ? "bg-primary" : "bg-border"
                        )}
                    />
                ))}
            </div>

            <div className="w-full max-w-lg z-10">
                <AnimatePresence custom={direction} mode="wait">
                    <motion.div
                        key={step}
                        custom={direction}
                        variants={variants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        className="w-full"
                    >
                        {/* Step 1: Activity */}
                        {step === 0 && (
                            <StepActivity
                                selected={formData.sport}
                                onSelect={(val) => updateData('sport', val)}
                            />
                        )}

                        {/* Step 2: Experience */}
                        {step === 1 && (
                            <StepLevel
                                selected={formData.level}
                                onSelect={(val) => updateData('level', val)}
                            />
                        )}

                        {/* Step 3: Goal */}
                        {step === 2 && (
                            <StepGoal
                                selected={formData.goal}
                                onSelect={(val) => updateData('goal', val)}
                            />
                        )}

                        {/* Step 4: Goal Date */}
                        {step === 3 && (
                            <StepDate
                                selected={formData.goalDate}
                                onSelect={(val) => updateData('goalDate', val)}
                            />
                        )}

                        {/* Step 5: Threshold */}
                        {step === 4 && (
                            <StepThreshold
                                values={formData.thresholdPace}
                                onChange={(val) => updateData('thresholdPace', val)}
                                isRunner={formData.sport === 'Running'}
                                onSkip={nextStep}
                            />
                        )}

                        {/* Step 6: Availability */}
                        {step === 5 && (
                            <StepAvailability
                                values={formData.availability}
                                split={formData.availabilitySplit}
                                am={formData.availabilityAM}
                                pm={formData.availabilityPM}
                                onChange={(val) => updateData('availability', val)}
                                onSplitChange={(val) => updateData('availabilitySplit', val)}
                                onAMChange={(val) => updateData('availabilityAM', val)}
                                onPMChange={(val) => updateData('availabilityPM', val)}
                            />
                        )}

                        {/* Step 7: Plan Start */}
                        {step === 6 && (
                            <StepPlanStart
                                selected={formData.planStartDate}
                                onSelect={(val) => updateData('planStartDate', val)}
                            />
                        )}

                        {/* Step 8: Gym */}
                        {step === 7 && (
                            <StepGym
                                selected={formData.gymAccess}
                                onSelect={(val) => updateData('gymAccess', val)}
                            />
                        )}

                        {/* Step 9: Summary */}
                        {step === 8 && (
                            <StepSummary
                                data={formData}
                                totalHours={totalHours}
                                onEdit={() => setStep(0)}
                            />
                        )}
                    </motion.div>
                </AnimatePresence>

                <div className="mt-8 flex items-center justify-between">
                    <Button
                        variant="ghost"
                        onClick={prevStep}
                        disabled={step === 0}
                        className={cn("text-muted-foreground", step === 0 && "invisible")}
                    >
                        <ChevronLeft className="w-4 h-4 mr-1" />
                        Back
                    </Button>

                    <Button
                        onClick={nextStep}
                        disabled={
                            (step === 0 && !formData.sport) ||
                            (step === 1 && !formData.level) ||
                            (step === 2 && !formData.goal)
                        }
                        className="rounded-full px-8 shadow-md"
                        size="lg"
                    >
                        {step === STEPS.length - 1 ? 'Generate Plan' : 'Continue'}
                        {step < STEPS.length - 1 && <ChevronRight className="w-4 h-4 ml-1" />}
                    </Button>
                </div>

                <div className="mt-4 text-center">
                    <button
                        onClick={() => navigate('/')}
                        className="text-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                        Skip for now
                    </button>
                </div>
            </div>
        </div>
    );
}

// --- Step Components ---

function StepActivity({ selected, onSelect }: { selected: string; onSelect: (v: string) => void }) {
    const options = [
        { id: 'Running', icon: Activity, title: 'Runner', desc: '5K to Marathon' },
        { id: 'Cycling', icon: Bike, title: 'Cyclist', desc: 'Road, Gravel, & Trail' },
        { id: 'Longevity', icon: Heart, title: 'Longevity', desc: 'Health & Mobility' },
    ];

    return (
        <div className="space-y-6">
            <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">What moves you?</h1>
                <p className="text-muted-foreground">We'll tailor your daily flow based on your primary focus.</p>
            </div>

            <div className="grid gap-4">
                {options.map((opt) => (
                    <div
                        key={opt.id}
                        onClick={() => onSelect(opt.id)}
                        className={cn(
                            "flex items-center p-4 rounded-2xl border-2 cursor-pointer transition-all duration-200 hover:scale-[1.02]",
                            selected === opt.id
                                ? "border-primary bg-primary/5 shadow-md"
                                : "border-transparent bg-white shadow-sm hover:shadow-md"
                        )}
                    >
                        <div className={cn(
                            "w-12 h-12 rounded-full flex items-center justify-center mr-4 transition-colors",
                            selected === opt.id ? "bg-primary text-white" : "bg-gray-100 text-gray-500"
                        )}>
                            <opt.icon className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-lg">{opt.title}</h3>
                            <p className="text-sm text-muted-foreground">{opt.desc}</p>
                        </div>
                        <div className="ml-auto">
                            {selected === opt.id && <Check className="w-6 h-6 text-primary" />}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function StepLevel({ selected, onSelect }: { selected: string; onSelect: (v: string) => void }) {
    const options = [
        { id: 'fresh_start', title: 'Beginner', desc: '0–15 km/week' },
        { id: 'transfer', title: 'Intermediate', desc: '15–40 km/week' },
        { id: 'consistent', title: 'Advanced', desc: '40–70 km/week' },
        { id: 'high_performance', title: 'Elite', desc: '70+ km/week' },
    ];

    return (
        <div className="space-y-6">
            <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">Your experience</h1>
                <p className="text-muted-foreground">Select your current weekly volume.</p>
            </div>
            <div className="grid gap-4">
                {options.map((opt) => (
                    <div
                        key={opt.id}
                        onClick={() => onSelect(opt.id)}
                        className={cn(
                            "p-5 rounded-2xl border-2 cursor-pointer transition-all duration-200 hover:scale-[1.01] text-center",
                            selected === opt.id
                                ? "border-primary bg-primary/5 shadow-md"
                                : "border-transparent bg-white shadow-sm hover:shadow-md"
                        )}
                    >
                        <h3 className="font-semibold text-lg">{opt.title}</h3>
                        <p className="text-sm text-muted-foreground">{opt.desc}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}

function StepGoal({ selected, onSelect }: { selected: string; onSelect: (v: string) => void }) {
    const options = [
        { id: 'Faster', icon: Flame, title: 'Get Faster' },
        { id: 'WeightLoss', icon: Activity, title: 'Lose Weight' },
        { id: 'Event', icon: Trophy, title: 'Event Prep' },
        { id: 'Health', icon: Heart, title: 'Health & Wellness' },
    ];

    return (
        <div className="space-y-6">
            <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">Set your goal</h1>
                <p className="text-muted-foreground">We'll adapt your training plan to help you reach your target.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
                {options.map((opt) => (
                    <div
                        key={opt.id}
                        onClick={() => onSelect(opt.id)}
                        className={cn(
                            "p-6 rounded-2xl border-2 cursor-pointer transition-all duration-200 hover:scale-[1.02] flex flex-col items-center justify-center gap-3 aspect-square",
                            selected === opt.id
                                ? "border-primary bg-primary/5 shadow-md"
                                : "border-transparent bg-white shadow-sm hover:shadow-md"
                        )}
                    >
                        <div className={cn(
                            "w-12 h-12 rounded-full flex items-center justify-center transition-colors",
                            selected === opt.id ? "bg-primary text-white" : "bg-gray-100 text-gray-500"
                        )}>
                            <opt.icon className="w-6 h-6" />
                        </div>
                        <h3 className="font-semibold text-center">{opt.title}</h3>
                    </div>
                ))}
            </div>
        </div>
    );
}

function StepDate({ selected, onSelect }: { selected: Date | undefined; onSelect: (v: Date | undefined) => void }) {
    return (
        <div className="space-y-6">
            <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">When is the big day?</h1>
                <p className="text-muted-foreground">We'll optimize your schedule to peak exactly when it matters.</p>
            </div>

            <div className="bg-white rounded-[22px] p-4 shadow-sm border flex justify-center">
                <Calendar
                    mode="single"
                    selected={selected}
                    onSelect={onSelect}
                    className="rounded-md border-0"
                    disabled={(date) => date < new Date()}
                />
            </div>

            <div className="flex items-center justify-center gap-2">
                <Button variant="outline" className="rounded-full" onClick={() => onSelect(undefined)}>
                    Just Training (No Date)
                </Button>
            </div>
        </div>
    );
}

function StepThreshold({ values, onChange, isRunner, onSkip }: {
    values: { min: string; sec: string };
    onChange: (v: { min: string; sec: string }) => void;
    isRunner: boolean;
    onSkip: () => void;
}) {
    if (!isRunner) {
        return (
            <div className="text-center space-y-4">
                <h1 className="text-2xl font-bold">Cycling Power Zones</h1>
                <p className="text-muted-foreground">We'll estimate your FTP based on your experience level.</p>
                <Button onClick={onSkip}>Use Estimates</Button>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">Threshold Pace</h1>
                <p className="text-muted-foreground">Your Lactate Threshold (LT) pace defines your training zones.</p>
            </div>

            <div className="flex items-center justify-center gap-4">
                <div className="space-y-2">
                    <Input
                        className="text-center text-4xl h-20 w-32 font-bold rounded-2xl"
                        placeholder="05"
                        value={values.min}
                        onChange={(e) => onChange({ ...values, min: e.target.value })}
                        type="number"
                    />
                    <p className="text-center text-sm text-muted-foreground">Min</p>
                </div>
                <span className="text-4xl font-bold text-muted-foreground">:</span>
                <div className="space-y-2">
                    <Input
                        className="text-center text-4xl h-20 w-32 font-bold rounded-2xl"
                        placeholder="00"
                        value={values.sec}
                        onChange={(e) => onChange({ ...values, sec: e.target.value })}
                        type="number"
                    />
                    <p className="text-center text-sm text-muted-foreground">Sec</p>
                </div>
            </div>

            <div className="text-center">
                <span className="text-lg font-medium text-muted-foreground">per km</span>
            </div>

            <div className="text-center">
                <button className="text-primary text-sm hover:underline" onClick={onSkip}>
                    I don't know my pace
                </button>
            </div>
        </div>
    );
}

function StepAvailability({
    values, split, am, pm,
    onChange, onSplitChange, onAMChange, onPMChange
}: {
    values: number[];
    split: boolean[];
    am: number[];
    pm: number[];
    onChange: (v: number[]) => void;
    onSplitChange: (v: boolean[]) => void;
    onAMChange: (v: number[]) => void;
    onPMChange: (v: number[]) => void;
}) {
    const handleSliderChange = (index: number, val: number[]) => {
        const newValues = [...values];
        newValues[index] = val[0];
        onChange(newValues);
    };

    const handleSplitToggle = (index: number) => {
        const newSplit = [...split];
        newSplit[index] = !newSplit[index];
        onSplitChange(newSplit);
    };

    const handleAMChange = (index: number, val: number[]) => {
        const newAM = [...am];
        newAM[index] = val[0];
        onAMChange(newAM);
    };

    const handlePMChange = (index: number, val: number[]) => {
        const newPM = [...pm];
        newPM[index] = val[0];
        onPMChange(newPM);
    };

    const copyMondayToWeek = () => {
        onChange([values[0], values[0], values[0], values[0], values[0], values[5], values[6]]);
        onSplitChange([split[0], split[0], split[0], split[0], split[0], split[5], split[6]]);
        onAMChange([am[0], am[0], am[0], am[0], am[0], am[5], am[6]]);
        onPMChange([pm[0], pm[0], pm[0], pm[0], pm[0], pm[5], pm[6]]);
    };

    const totalHours = values.reduce((a, b) => a + b, 0);

    return (
        <div className="space-y-6">
            <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">Weekly Schedule</h1>
                <p className="text-muted-foreground">Set your daily training capacity (hours).</p>
            </div>

            <div className="text-center p-4 rounded-2xl bg-primary/10">
                <p className="text-sm text-muted-foreground">Total Weekly</p>
                <p className="text-3xl font-bold text-primary">{totalHours}h</p>
            </div>

            <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-2">
                {DAYS.map((day, i) => (
                    <div key={day} className="bg-white p-4 rounded-2xl shadow-sm border space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center font-bold text-secondary-foreground">
                                    {day}
                                </div>
                                <div>
                                    <p className="font-semibold text-sm">{split[i] ? 'Split sessions' : 'Total'}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {split[i] ? `${am[i]}h AM + ${pm[i]}h PM` : `${values[i]}h`}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <label className="text-xs font-medium text-muted-foreground">AM/PM</label>
                                <Switch checked={split[i]} onCheckedChange={() => handleSplitToggle(i)} />
                            </div>
                        </div>

                        {!split[i] ? (
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="font-medium">Training time</span>
                                    <span className="text-primary font-bold">{values[i]}h</span>
                                </div>
                                <Slider
                                    min={0} max={4} step={0.5}
                                    value={[values[i]]}
                                    onValueChange={(val) => handleSliderChange(i, val)}
                                />
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs">
                                        <span className="font-medium">Morning</span>
                                        <span className="text-primary font-bold">{am[i]}h</span>
                                    </div>
                                    <Slider
                                        min={0} max={3} step={0.5}
                                        value={[am[i]]}
                                        onValueChange={(val) => handleAMChange(i, val)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs">
                                        <span className="font-medium">Evening</span>
                                        <span className="text-primary font-bold">{pm[i]}h</span>
                                    </div>
                                    <Slider
                                        min={0} max={3} step={0.5}
                                        value={[pm[i]]}
                                        onValueChange={(val) => handlePMChange(i, val)}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <Button
                variant="outline"
                onClick={copyMondayToWeek}
                className="w-full rounded-full flex items-center gap-2"
            >
                <Copy className="w-4 h-4" />
                Copy Monday to Weekdays
            </Button>
        </div>
    );
}

function StepPlanStart({ selected, onSelect }: { selected: Date | undefined; onSelect: (v: Date | undefined) => void }) {
    return (
        <div className="space-y-6">
            <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">When do you start?</h1>
                <p className="text-muted-foreground">Choose the date your training plan begins.</p>
            </div>

            <div className="bg-white rounded-[22px] p-4 shadow-sm border flex justify-center">
                <Calendar
                    mode="single"
                    selected={selected}
                    onSelect={onSelect}
                    className="rounded-md border-0"
                    disabled={(date) => date < new Date()}
                />
            </div>

            <div className="text-center">
                <Button variant="outline" className="rounded-full" onClick={() => onSelect(new Date())}>
                    Start Today
                </Button>
            </div>
        </div>
    );
}

function StepGym({ selected, onSelect }: { selected: string; onSelect: (v: string) => void }) {
    const options = [
        { id: 'full', icon: Dumbbell, title: 'Commercial Gym', desc: 'Full equipment access' },
        { id: 'basic', icon: Home, title: 'Home Setup', desc: 'Basic weights & bench' },
        { id: 'none', icon: User, title: 'Bodyweight Only', desc: 'No equipment needed' },
    ];

    return (
        <div className="space-y-6">
            <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">Gym Access?</h1>
                <p className="text-muted-foreground">We'll tailor your strength training to your available equipment.</p>
            </div>

            <div className="grid gap-4">
                {options.map((opt) => (
                    <div
                        key={opt.id}
                        onClick={() => onSelect(opt.id)}
                        className={cn(
                            "flex items-center p-4 rounded-2xl border-2 cursor-pointer transition-all duration-200 hover:scale-[1.02]",
                            selected === opt.id
                                ? "border-primary bg-primary/5 shadow-md"
                                : "border-transparent bg-white shadow-sm hover:shadow-md"
                        )}
                    >
                        <div className={cn(
                            "w-12 h-12 rounded-full flex items-center justify-center mr-4 transition-colors",
                            selected === opt.id ? "bg-primary text-white" : "bg-gray-100 text-gray-500"
                        )}>
                            <opt.icon className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-lg">{opt.title}</h3>
                            <p className="text-sm text-muted-foreground">{opt.desc}</p>
                        </div>
                        <div className="ml-auto">
                            {selected === opt.id && <Check className="w-6 h-6 text-primary" />}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function StepSummary({ data, totalHours, onEdit }: { data: any; totalHours: number; onEdit: () => void }) {
    const levelLabels: Record<string, string> = {
        'fresh_start': 'Beginner',
        'transfer': 'Intermediate',
        'consistent': 'Advanced',
        'high_performance': 'Elite',
    };

    return (
        <div className="space-y-6">
            <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">Review your plan.</h1>
                <p className="text-muted-foreground">We've optimized your schedule for maximum performance.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <Card className="p-4 bg-white/50 border-transparent">
                    <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-1">Sport</p>
                    <p className="font-semibold text-lg">{data.sport}</p>
                </Card>
                <Card className="p-4 bg-white/50 border-transparent">
                    <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-1">Level</p>
                    <p className="font-semibold text-lg">{levelLabels[data.level] || data.level}</p>
                </Card>
                <Card className="p-4 bg-white/50 border-transparent">
                    <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-1">Goal</p>
                    <p className="font-semibold text-lg">{data.goal}</p>
                </Card>
                <Card className="p-4 bg-white/50 border-transparent">
                    <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-1">Weekly</p>
                    <p className="font-semibold text-lg">~{totalHours} hours</p>
                </Card>
            </div>

            <div className="text-center">
                <Button variant="link" onClick={onEdit} className="text-muted-foreground">
                    Edit preferences
                </Button>
            </div>

            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                Data stored locally on your device.
            </div>
        </div>
    );
}
