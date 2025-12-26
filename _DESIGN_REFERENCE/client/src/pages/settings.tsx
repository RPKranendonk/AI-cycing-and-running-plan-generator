import { useState } from "react";
import { useApp } from "@/lib/app-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { CheckCircle2, Copy } from "lucide-react";

export default function Settings() {
  const { user, updateUser } = useApp();
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [activeTab, setActiveTab] = useState("profile");

  if (!user) return null;

  const handleSave = async () => {
    setSaveStatus("saving");
    await new Promise((resolve) => setTimeout(resolve, 500));
    setSaveStatus("saved");
    setTimeout(() => setSaveStatus("idle"), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        {saveStatus !== "idle" && (
          <div className="flex items-center gap-2 text-sm">
            {saveStatus === "saving" && <span className="text-muted-foreground">Saving...</span>}
            {saveStatus === "saved" && (
              <div className="flex items-center gap-1 text-green-600">
                <CheckCircle2 className="w-4 h-4" />
                <span>Saved</span>
              </div>
            )}
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-3 md:grid-cols-5 w-full bg-white rounded-full shadow-sm p-1 border">
          <TabsTrigger value="profile" className="rounded-full">Profile</TabsTrigger>
          <TabsTrigger value="create-plan" className="rounded-full">Create Plan</TabsTrigger>
          <TabsTrigger value="availability" className="rounded-full">Availability</TabsTrigger>
          <TabsTrigger value="zones-running" className="rounded-full">Zones (Run)</TabsTrigger>
          <TabsTrigger value="zones-cycling" className="rounded-full">Zones (Bike)</TabsTrigger>
        </TabsList>

        {/* Tab 1: Profile */}
        <TabsContent value="profile" className="space-y-6">
          <Card className="bg-white border-none shadow-sm">
            <CardHeader>
              <CardTitle>Athlete Profile</CardTitle>
              <CardDescription>Your account and integrations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="text-base font-semibold mb-2 block">Display Name</Label>
                <Input
                  placeholder="Your name"
                  defaultValue={user.name}
                  className="rounded-xl h-12"
                  onChange={(e) => updateUser({ name: e.target.value })}
                />
              </div>

              <div>
                <Label className="text-base font-semibold mb-2 block">Gym Access</Label>
                <Select defaultValue={user.gymAccess}>
                  <SelectTrigger className="rounded-xl h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Bodyweight">Bodyweight Only</SelectItem>
                    <SelectItem value="Home">Home Setup</SelectItem>
                    <SelectItem value="Commercial">Commercial Gym</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <Label className="font-semibold">Units</Label>
                <RadioGroup defaultValue="metric" className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="metric" id="metric" />
                    <Label htmlFor="metric" className="cursor-pointer">Metric (km, kg)</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="imperial" id="imperial" />
                    <Label htmlFor="imperial" className="cursor-pointer">Imperial (mi, lbs)</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="pt-6 border-t">
                <h4 className="font-semibold mb-4 text-lg">Integrations</h4>
                
                {/* Intervals.icu Integration */}
                <div className="space-y-4 mb-6">
                  <div>
                    <Label className="text-base font-semibold mb-2 block">Intervals.icu API Key</Label>
                    <Input
                      type="password"
                      placeholder="Enter your Intervals.icu API key"
                      className="rounded-xl h-12"
                    />
                  </div>
                  <div>
                    <Label className="text-base font-semibold mb-2 block">Athlete ID</Label>
                    <Input
                      type="text"
                      placeholder="Your Intervals.icu Athlete ID"
                      className="rounded-xl h-12"
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      Get your API key and Athlete ID from <a href="https://intervals.icu" target="_blank" rel="noopener noreferrer" className="text-primary underline">Intervals.icu settings</a>
                    </p>
                  </div>
                </div>

                {/* AI Integration */}
                <div className="space-y-4 pt-6 border-t">
                  <h5 className="font-semibold text-base">AI Coach Model</h5>
                  <div>
                    <Label className="text-sm font-semibold mb-2 block">Model</Label>
                    <Select defaultValue="gemini">
                      <SelectTrigger className="rounded-xl h-12">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gemini">Google Gemini</SelectItem>
                        <SelectItem value="deepseek">DeepSeek</SelectItem>
                        <SelectItem value="mistral">Mistral</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold mb-2 block">API Key</Label>
                    <Input
                      type="password"
                      placeholder="Enter your AI model API key"
                      className="rounded-xl h-12"
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      Your API key is stored locally and never shared with our servers.
                    </p>
                  </div>
                </div>
              </div>

              <Button onClick={handleSave} className="w-full rounded-full">
                Save Profile
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Create Plan */}
        <TabsContent value="create-plan" className="space-y-6">
          <Card className="bg-white border-none shadow-sm">
            <CardHeader>
              <CardTitle>Create Training Plan</CardTitle>
              <CardDescription>Define your sport, experience, and training goals</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="text-base font-semibold mb-2 block">Primary Sport</Label>
                <Select defaultValue={user.sport}>
                  <SelectTrigger className="rounded-xl h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Runner">Running</SelectItem>
                    <SelectItem value="Cyclist">Cycling</SelectItem>
                    <SelectItem value="Longevity">Longevity</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-base font-semibold mb-3 block">Experience Level</Label>
                <RadioGroup defaultValue={user.level}>
                  {["Beginner", "Intermediate", "Advanced"].map((level) => (
                    <div key={level} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-gray-50 cursor-pointer">
                      <RadioGroupItem value={level} id={level} />
                      <Label htmlFor={level} className="cursor-pointer font-medium">{level}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <div>
                <Label className="text-base font-semibold mb-2 block">Training History</Label>
                <Textarea placeholder="Describe your recent training, volume, and any major events..." className="rounded-xl min-h-[120px]" />
              </div>

              <div>
                <Label className="text-base font-semibold mb-2 block">Injuries / Constraints</Label>
                <Textarea placeholder="Any physical limitations we should know about?" className="rounded-xl min-h-[100px]" />
              </div>

              <div className="pt-6 border-t">
                <h4 className="font-semibold mb-4 text-lg">Training Goal</h4>
                
                <Label className="text-base font-semibold mb-3 block">Goal Type</Label>
                <RadioGroup defaultValue={user.goal}>
                  {["Faster", "WeightLoss", "Event", "Health"].map((goal) => (
                    <div key={goal} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-gray-50 cursor-pointer">
                      <RadioGroupItem value={goal} id={goal} />
                      <Label htmlFor={goal} className="cursor-pointer font-medium">
                        {goal === "Faster" && "Get Faster"}
                        {goal === "WeightLoss" && "Lose Weight"}
                        {goal === "Event" && "Event Prep"}
                        {goal === "Health" && "Health & Wellness"}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <div>
                <Label className="text-base font-semibold mb-2 block">Target Event (Optional)</Label>
                <Input placeholder="e.g., Boston Marathon" className="rounded-xl h-12" />
              </div>

              <div>
                <Label className="text-base font-semibold mb-2 block">Goal Date</Label>
                <Input type="date" className="rounded-xl h-12" defaultValue={user.goalDate ? new Date(user.goalDate).toISOString().split('T')[0] : ""} />
              </div>

              <div>
                <Label className="text-base font-semibold mb-2 block">Plan Start Date</Label>
                <Input 
                  type="date" 
                  className="rounded-xl h-12" 
                />
              </div>

              <div>
                <Label className="text-base font-semibold mb-2 block">Starting Weekly Volume (km)</Label>
                <div className="flex items-center gap-4">
                  <Slider min={5} max={80} step={5} defaultValue={[30]} className="flex-1" />
                  <Input type="number" className="w-20 rounded-lg" placeholder="30" />
                </div>
              </div>

              <div>
                <Label className="text-base font-semibold mb-2 block">Progression Rate</Label>
                <RadioGroup defaultValue="moderate">
                  <div className="flex items-center gap-3 p-3 rounded-lg border hover:bg-gray-50 cursor-pointer">
                    <RadioGroupItem value="conservative" id="conservative" />
                    <Label htmlFor="conservative" className="cursor-pointer">Conservative (+5%/wk)</Label>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg border hover:bg-gray-50 cursor-pointer">
                    <RadioGroupItem value="moderate" id="moderate" />
                    <Label htmlFor="moderate" className="cursor-pointer">Moderate (+8%/wk)</Label>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg border hover:bg-gray-50 cursor-pointer">
                    <RadioGroupItem value="aggressive" id="aggressive" />
                    <Label htmlFor="aggressive" className="cursor-pointer">Aggressive (+10%/wk)</Label>
                  </div>
                </RadioGroup>
              </div>

              <Button onClick={handleSave} className="w-full rounded-full">
                Save Plan
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Availability */}
        <TabsContent value="availability" className="space-y-6">
          <Card className="bg-white border-none shadow-sm">
            <CardHeader>
              <CardTitle>Weekly Schedule</CardTitle>
              <CardDescription>Set your daily training capacity (hours)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, idx) => {
                // Get availability data - use separate AM/PM if available, otherwise fallback to total
                const availabilitySplit = (user as any).availabilitySplit?.[idx] || false;
                const totalHours = user.weeklyAvailability?.[idx] || 1;
                const amHours = (user as any).availabilityAM?.[idx] || 0.5;
                const pmHours = (user as any).availabilityPM?.[idx] || 0.5;

                return (
                  <div key={day} className="bg-gray-50 p-4 rounded-2xl shadow-sm border space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center font-bold text-secondary-foreground">
                          {day}
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{availabilitySplit ? "Split sessions" : "Total"}</p>
                          <p className="text-xs text-muted-foreground">{availabilitySplit ? `${amHours}h AM + ${pmHours}h PM` : `${totalHours}h`}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-medium text-muted-foreground">AM/PM</label>
                        <Switch 
                          checked={availabilitySplit} 
                          onCheckedChange={() => {
                            const newSplit = [...((user as any).availabilitySplit || [false, false, false, false, false, false, false])];
                            newSplit[idx] = !newSplit[idx];
                            updateUser({ availabilitySplit: newSplit } as any);
                          }} 
                        />
                      </div>
                    </div>

                    {!availabilitySplit ? (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">Training time</span>
                          <span className="text-primary font-bold">{totalHours}h</span>
                        </div>
                        <Slider 
                          min={0} max={6} step={0.5} 
                          value={[totalHours]} 
                          onValueChange={(val) => {
                            const newAvail = [...(user.weeklyAvailability || [1, 1, 1, 1, 1, 2, 2])];
                            newAvail[idx] = val[0];
                            updateUser({ weeklyAvailability: newAvail });
                          }}
                        />
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs">
                            <span className="font-medium">Morning</span>
                            <span className="text-primary font-bold">{amHours}h</span>
                          </div>
                          <Slider 
                            min={0} max={3} step={0.5} 
                            value={[amHours]} 
                            onValueChange={(val) => {
                              const newAM = [...((user as any).availabilityAM || [0.5, 0.5, 0.5, 0.5, 0.5, 1, 1])];
                              newAM[idx] = val[0];
                              updateUser({ availabilityAM: newAM } as any);
                            }}
                          />
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs">
                            <span className="font-medium">Evening</span>
                            <span className="text-primary font-bold">{pmHours}h</span>
                          </div>
                          <Slider 
                            min={0} max={3} step={0.5} 
                            value={[pmHours]} 
                            onValueChange={(val) => {
                              const newPM = [...((user as any).availabilityPM || [0.5, 0.5, 0.5, 0.5, 0.5, 1, 1])];
                              newPM[idx] = val[0];
                              updateUser({ availabilityPM: newPM } as any);
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              <Button 
                variant="outline" 
                onClick={() => {
                  const newValues = [user.weeklyAvailability?.[0] || 1, user.weeklyAvailability?.[0] || 1, user.weeklyAvailability?.[0] || 1, user.weeklyAvailability?.[0] || 1, user.weeklyAvailability?.[0] || 1, user.weeklyAvailability?.[0] || 1, user.weeklyAvailability?.[0] || 1];
                  const newSplit = [...((user as any).availabilitySplit || [false, false, false, false, false, false, false])];
                  const newAM = [...((user as any).availabilityAM || [0.5, 0.5, 0.5, 0.5, 0.5, 1, 1])];
                  const newPM = [...((user as any).availabilityPM || [0.5, 0.5, 0.5, 0.5, 0.5, 1, 1])];
                  
                  newSplit[1] = newSplit[0]; newSplit[2] = newSplit[0]; newSplit[3] = newSplit[0]; newSplit[4] = newSplit[0]; newSplit[5] = newSplit[0]; newSplit[6] = newSplit[0];
                  newAM[1] = newAM[0]; newAM[2] = newAM[0]; newAM[3] = newAM[0]; newAM[4] = newAM[0]; newAM[5] = newAM[0]; newAM[6] = newAM[0];
                  newPM[1] = newPM[0]; newPM[2] = newPM[0]; newPM[3] = newPM[0]; newPM[4] = newPM[0]; newPM[5] = newPM[0]; newPM[6] = newPM[0];
                  
                  updateUser({ weeklyAvailability: newValues, availabilitySplit: newSplit, availabilityAM: newAM, availabilityPM: newPM } as any);
                }}
                className="w-full rounded-full flex items-center gap-2"
              >
                <Copy className="w-4 h-4" />
                Copy Monday to Workweek
              </Button>

              <div className="pt-4 flex gap-2">
                <Button variant="outline" onClick={() => updateUser({ weeklyAvailability: [1, 1, 1, 1, 1, 2, 2], availabilitySplit: [false, false, false, false, false, false, false], availabilityAM: [0.5, 0.5, 0.5, 0.5, 0.5, 1, 1], availabilityPM: [0.5, 0.5, 0.5, 0.5, 0.5, 1, 1] } as any)} className="rounded-full flex-1">
                  Reset to Defaults
                </Button>
                <Button onClick={handleSave} className="rounded-full flex-1">
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Running Zones */}
        <TabsContent value="zones-running" className="space-y-6">
          <Card className="bg-white border-none shadow-sm">
            <CardHeader>
              <CardTitle>Running Zones</CardTitle>
              <CardDescription>Lactate Threshold based zones</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-semibold mb-2 block">LT Pace (min)</Label>
                  <Input type="number" defaultValue={user.thresholdPace?.split(":")?.[0] || "5"} className="rounded-xl h-10" />
                </div>
                <div>
                  <Label className="text-sm font-semibold mb-2 block">LT Pace (sec)</Label>
                  <Input type="number" defaultValue={user.thresholdPace?.split(":")?.[1] || "00"} className="rounded-xl h-10" />
                </div>
              </div>

              <div>
                <Label className="text-base font-semibold mb-2 block">Lactate Threshold HR (bpm)</Label>
                <Input type="number" placeholder="180" className="rounded-xl h-12" />
              </div>

              <div>
                <Label className="text-base font-semibold mb-2 block">Max Heart Rate (bpm)</Label>
                <Input type="number" placeholder="190" className="rounded-xl h-12" />
              </div>

              <div>
                <Label className="text-base font-semibold mb-2 block">Resting Heart Rate (bpm)</Label>
                <Input type="number" placeholder="60" className="rounded-xl h-12" />
              </div>

              {/* Zone Table */}
              <div className="mt-6 space-y-3">
                <h4 className="font-semibold text-base">Calculated Running Zones</h4>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                  <div className="flex justify-between font-bold text-xs text-muted-foreground uppercase">
                    <span>Zone</span>
                    <span>Pace Range</span>
                  </div>
                  <div className="border-t pt-2 space-y-2">
                    {[
                      { zone: "Z1", name: "Recovery", pace: "6:30–7:00" },
                      { zone: "Z2", name: "Endurance", pace: "5:45–6:30" },
                      { zone: "Z3", name: "Tempo", pace: "5:15–5:45" },
                      { zone: "Z4", name: "Threshold", pace: "4:50–5:15" },
                      { zone: "Z5", name: "VO2max", pace: "4:20–4:50" },
                    ].map((z) => (
                      <div key={z.zone} className="flex justify-between text-xs">
                        <span className="font-medium">{z.zone} {z.name}</span>
                        <span className="text-muted-foreground">{z.pace} /km</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between font-bold text-xs text-muted-foreground uppercase">
                  <span>Zone</span>
                  <span>HR Range</span>
                </div>
                <div className="border-t pt-2 space-y-2">
                  {[
                    { zone: "Z1", name: "Recovery", hr: "<130" },
                    { zone: "Z2", name: "Endurance", hr: "130–150" },
                    { zone: "Z3", name: "Tempo", hr: "150–165" },
                    { zone: "Z4", name: "Threshold", hr: "165–175" },
                    { zone: "Z5", name: "VO2max", hr: ">175" },
                  ].map((z) => (
                    <div key={z.zone} className="flex justify-between text-xs">
                      <span className="font-medium">{z.zone} {z.name}</span>
                      <span className="text-muted-foreground">{z.hr} bpm</span>
                    </div>
                  ))}
                </div>
              </div>

              <Button onClick={handleSave} className="w-full rounded-full">
                Save Running Zones
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 5: Cycling Zones */}
        <TabsContent value="zones-cycling" className="space-y-6">
          <Card className="bg-white border-none shadow-sm">
            <CardHeader>
              <CardTitle>Cycling Zones</CardTitle>
              <CardDescription>FTP (Functional Threshold Power) based zones</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="text-base font-semibold mb-2 block">FTP (Watts)</Label>
                <Input type="number" placeholder="250" className="rounded-xl h-12" />
              </div>

              <div>
                <Label className="text-base font-semibold mb-2 block">Lactate Threshold HR (bpm)</Label>
                <Input type="number" placeholder="175" className="rounded-xl h-12" />
              </div>

              <div>
                <Label className="text-base font-semibold mb-2 block">Max Heart Rate (bpm)</Label>
                <Input type="number" placeholder="190" className="rounded-xl h-12" />
              </div>

              <div>
                <Label className="text-base font-semibold mb-2 block">Resting Heart Rate (bpm)</Label>
                <Input type="number" placeholder="60" className="rounded-xl h-12" />
              </div>

              {/* Cycling Zone Table */}
              <div className="mt-6 space-y-3">
                <h4 className="font-semibold text-base">Calculated Cycling Zones (Power)</h4>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                  <div className="flex justify-between font-bold text-xs text-muted-foreground uppercase">
                    <span>Zone</span>
                    <span>Power Range (% FTP)</span>
                  </div>
                  <div className="border-t pt-2 space-y-2">
                    {[
                      { zone: "Z1", name: "Recovery", power: "<55%" },
                      { zone: "Z2", name: "Endurance", power: "55–75%" },
                      { zone: "Z3", name: "Tempo", power: "75–90%" },
                      { zone: "Z4", name: "Threshold", power: "90–105%" },
                      { zone: "Z5", name: "VO2max", power: "105–120%" },
                    ].map((z) => (
                      <div key={z.zone} className="flex justify-between text-xs">
                        <span className="font-medium">{z.zone} {z.name}</span>
                        <span className="text-muted-foreground">{z.power}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between font-bold text-xs text-muted-foreground uppercase">
                  <span>Zone</span>
                  <span>HR Range</span>
                </div>
                <div className="border-t pt-2 space-y-2">
                  {[
                    { zone: "Z1", name: "Recovery", hr: "<130" },
                    { zone: "Z2", name: "Endurance", hr: "130–150" },
                    { zone: "Z3", name: "Tempo", hr: "150–165" },
                    { zone: "Z4", name: "Threshold", hr: "165–175" },
                    { zone: "Z5", name: "VO2max", hr: ">175" },
                  ].map((z) => (
                    <div key={z.zone} className="flex justify-between text-xs">
                      <span className="font-medium">{z.zone} {z.name}</span>
                      <span className="text-muted-foreground">{z.hr} bpm</span>
                    </div>
                  ))}
                </div>
              </div>

              <Button onClick={handleSave} className="w-full rounded-full">
                Save Cycling Zones
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
