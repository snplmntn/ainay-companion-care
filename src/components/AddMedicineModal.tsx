import React, { useState } from 'react';
import { X, Camera, Mic, Keyboard, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useApp } from '@/contexts/AppContext';
import { toast } from '@/hooks/use-toast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

type Tab = 'scan' | 'talk' | 'type';

export function AddMedicineModal({ isOpen, onClose }: Props) {
  const { addMedication } = useApp();
  const [activeTab, setActiveTab] = useState<Tab>('talk');
  const [isListening, setIsListening] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    dosage: '',
    time: '',
    instructions: '',
  });

  if (!isOpen) return null;

  const tabs = [
    { id: 'scan' as Tab, label: 'Scan', icon: Camera },
    { id: 'talk' as Tab, label: 'Talk', icon: Mic },
    { id: 'type' as Tab, label: 'Type', icon: Keyboard },
  ];

  // TODO: Replace with OpenAI Whisper API (Speech-to-Text)
  const handleVoiceInput = () => {
    setIsListening(true);
    
    // Simulate voice recognition
    setTimeout(() => {
      setIsListening(false);
      setFormData({
        name: 'Amlodipine',
        dosage: '10mg',
        time: '8:00 AM',
        instructions: 'Take with water',
      });
      toast({
        title: "Voice recognized!",
        description: "Medicine details have been filled in.",
      });
    }, 3000);
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.dosage || !formData.time) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    addMedication(formData);
    toast({
      title: "Medicine added!",
      description: `${formData.name} has been added to your list.`,
    });
    onClose();
    setFormData({ name: '', dosage: '', time: '', instructions: '' });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center">
      <div className="bg-background w-full max-w-lg rounded-t-3xl slide-up max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-senior-xl font-bold">Add Medicine</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-6 h-6" />
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex p-4 gap-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-xl transition-all ${
                activeTab === tab.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              <tab.icon className="w-6 h-6" />
              <span className="text-senior-sm font-semibold">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-6">
        {activeTab === 'scan' && (
            <div className="text-center py-8">
              {isScanning ? (
                <>
                  {/* Scanning Animation */}
                  <div className="w-48 h-48 mx-auto bg-muted rounded-3xl flex items-center justify-center mb-6 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-b from-primary/20 to-transparent animate-pulse" />
                    <div className="absolute top-0 left-0 right-0 h-1 bg-primary animate-[scan_2s_ease-in-out_infinite]" />
                    <Camera className="w-16 h-16 text-muted-foreground" />
                  </div>
                  <p className="text-senior-lg font-semibold text-primary mb-2">Scanning...</p>
                  <p className="text-senior-sm text-muted-foreground">
                    Reading medicine label
                  </p>
                </>
              ) : (
                <>
                  <div className="w-32 h-32 mx-auto bg-muted rounded-3xl flex items-center justify-center mb-6">
                    <Camera className="w-16 h-16 text-muted-foreground" />
                  </div>
                  <p className="text-senior-base text-muted-foreground mb-4">
                    Point your camera at the medicine label
                  </p>
                  <Button 
                    variant="coral" 
                    size="lg" 
                    className="w-full"
                    onClick={() => {
                      setIsScanning(true);
                      // TODO: Connect to OCR API
                      // Simulate scanning
                      setTimeout(() => {
                        setIsScanning(false);
                        setFormData({
                          name: 'Metformin',
                          dosage: '500mg',
                          time: '12:00 PM',
                          instructions: 'Take with food',
                        });
                        toast({
                          title: "Scan complete!",
                          description: "Medicine details have been detected.",
                        });
                      }, 3000);
                    }}
                  >
                    <Camera className="w-6 h-6" />
                    Scan Medicine
                  </Button>
                </>
              )}

              {/* Form (shown after scan) */}
              {formData.name && !isScanning && (
                <div className="space-y-4 text-left mt-6">
                  <div>
                    <label className="text-senior-sm font-semibold text-muted-foreground mb-2 block">
                      Medicine Name
                    </label>
                    <Input
                      value={formData.name}
                      onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., Metformin"
                      className="input-senior"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-senior-sm font-semibold text-muted-foreground mb-2 block">
                        Dosage
                      </label>
                      <Input
                        value={formData.dosage}
                        onChange={e => setFormData(prev => ({ ...prev, dosage: e.target.value }))}
                        placeholder="e.g., 500mg"
                        className="input-senior"
                      />
                    </div>
                    <div>
                      <label className="text-senior-sm font-semibold text-muted-foreground mb-2 block">
                        Time
                      </label>
                      <Input
                        value={formData.time}
                        onChange={e => setFormData(prev => ({ ...prev, time: e.target.value }))}
                        placeholder="e.g., 12:00 PM"
                        className="input-senior"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'talk' && (
            <div className="text-center">
              {/* Voice Input Button */}
              <button
                onClick={handleVoiceInput}
                disabled={isListening}
                className={`w-32 h-32 mx-auto rounded-full flex items-center justify-center mb-6 transition-all ${
                  isListening
                    ? 'bg-primary pulse-ring'
                    : 'bg-primary hover:brightness-110'
                }`}
              >
                <Mic className="w-16 h-16 text-white" />
              </button>

              {isListening ? (
                <div className="mb-8">
                  <p className="text-senior-lg font-semibold text-primary mb-4">Listening...</p>
                  {/* Waveform Animation */}
                  <div className="flex items-center justify-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <div
                        key={i}
                        className="w-2 bg-primary rounded-full waveform"
                        style={{
                          height: `${20 + Math.random() * 20}px`,
                          animationDelay: `${i * 0.1}s`,
                        }}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-senior-base text-muted-foreground mb-8">
                  Tap the microphone and say the medicine name, dosage, and when to take it
                </p>
              )}

              {/* Form (auto-filled after voice) */}
              {(formData.name || !isListening) && (
                <div className="space-y-4 text-left">
                  <div>
                    <label className="text-senior-sm font-semibold text-muted-foreground mb-2 block">
                      Medicine Name
                    </label>
                    <Input
                      value={formData.name}
                      onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., Amlodipine"
                      className="input-senior"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-senior-sm font-semibold text-muted-foreground mb-2 block">
                        Dosage
                      </label>
                      <Input
                        value={formData.dosage}
                        onChange={e => setFormData(prev => ({ ...prev, dosage: e.target.value }))}
                        placeholder="e.g., 10mg"
                        className="input-senior"
                      />
                    </div>
                    <div>
                      <label className="text-senior-sm font-semibold text-muted-foreground mb-2 block">
                        Time
                      </label>
                      <Input
                        value={formData.time}
                        onChange={e => setFormData(prev => ({ ...prev, time: e.target.value }))}
                        placeholder="e.g., 8:00 AM"
                        className="input-senior"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'type' && (
            <div className="space-y-4">
              <div>
                <label className="text-senior-sm font-semibold text-muted-foreground mb-2 block">
                  Medicine Name *
                </label>
                <Input
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter medicine name"
                  className="input-senior"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-senior-sm font-semibold text-muted-foreground mb-2 block">
                    Dosage *
                  </label>
                  <Input
                    value={formData.dosage}
                    onChange={e => setFormData(prev => ({ ...prev, dosage: e.target.value }))}
                    placeholder="e.g., 10mg"
                    className="input-senior"
                  />
                </div>
                <div>
                  <label className="text-senior-sm font-semibold text-muted-foreground mb-2 block">
                    Time *
                  </label>
                  <Input
                    value={formData.time}
                    onChange={e => setFormData(prev => ({ ...prev, time: e.target.value }))}
                    placeholder="e.g., 8:00 AM"
                    className="input-senior"
                  />
                </div>
              </div>
              <div>
                <label className="text-senior-sm font-semibold text-muted-foreground mb-2 block">
                  Instructions (optional)
                </label>
                <Input
                  value={formData.instructions}
                  onChange={e => setFormData(prev => ({ ...prev, instructions: e.target.value }))}
                  placeholder="e.g., Take after meals"
                  className="input-senior"
                />
              </div>
            </div>
          )}

          {/* Submit Button */}
          {(activeTab === 'type' || formData.name) && (
            <Button
              variant="coral"
              size="lg"
              className="w-full mt-6"
              onClick={handleSubmit}
            >
              <Check className="w-6 h-6" />
              Save Medicine
            </Button>
          )}
        </div>

        {/* Safe area padding */}
        <div className="h-safe-bottom" />
      </div>
    </div>
  );
}
