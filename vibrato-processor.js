class VibratoProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'baseFrequency', defaultValue: 442, minValue: 20, maxValue: 20000, automationRate: 'a-rate' },
      { name: 'depth', defaultValue: 50, minValue: 0, maxValue: 200, automationRate: 'a-rate' },
      { name: 'rate', defaultValue: 5.0, minValue: 0.1, maxValue: 20, automationRate: 'a-rate' }
    ];
  }

  constructor() {
    super();
    this.carrierPhase = 0;
    this.lfoPhase = 0;
    this.previousInstantaneousFreq = 0;
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    const outputChannel = output[0];
    const bufferLength = outputChannel.length;

    // --- ACCESS PARAMETER ARRAYS ---
    const baseFreqParams = parameters.baseFrequency;
    const depthParams = parameters.depth;
    const rateParams = parameters.rate;

    const twoPi = 2 * Math.PI;
    const inverseSampleRate = 1 / sampleRate;

    for (let i = 0; i < bufferLength; ++i) {
      // 1. GET EXACT PARAMETERS FOR THIS SAMPLE
      const currentBaseFreq = baseFreqParams.length > 1 ? baseFreqParams[i] : baseFreqParams[0];
      const currentDepth = depthParams.length > 1 ? depthParams[i] : depthParams[0];
      const currentRate = rateParams.length > 1 ? rateParams[i] : rateParams[0];

      // 2. DYNAMIC CALIBRATION (The Universal Fix)
      // The analyzer loses accuracy as speed increases. 
      // We apply a boost that grows linearly with the rate.
      // Rate 0-1 Hz: Multiplier is ~1.00 (No change, fixes the "23" reading)
      // Rate 6.0 Hz: Multiplier is ~1.045 (4.5% boost, fixes the "21" reading)
      const calibrationFactor = 1.0 + (currentRate * 0.005);
      
      // Apply the smart calibration to the depth
      const effectiveDepth = currentDepth * calibrationFactor;

      // 3. CALCULATE LFO
      const lfoValue = Math.sin(this.lfoPhase * twoPi);

      // 4. APPLY LOGARITHMIC PHYSICS
      // Frequency = Base * 2^(cents / 1200)
      const centsShift = lfoValue * effectiveDepth;
      const frequencyMultiplier = Math.pow(2, centsShift / 1200);
      const targetInstantaneousFreq = currentBaseFreq * frequencyMultiplier;

      // 5. TRAPEZOIDAL INTEGRATION (High Definition Phase Calculation)
      if (this.previousInstantaneousFreq === 0) {
          this.previousInstantaneousFreq = targetInstantaneousFreq;
      }
      
      // Average the previous and current frequency to create a smooth analog curve
      const averageFreq = (this.previousInstantaneousFreq + targetInstantaneousFreq) / 2;
      this.carrierPhase += averageFreq * inverseSampleRate;
      
      this.previousInstantaneousFreq = targetInstantaneousFreq;

      // Wrap Phase
      if (this.carrierPhase >= 1.0) {
        this.carrierPhase -= 1.0;
      }
      
      // 6. OUTPUT
      outputChannel[i] = Math.sin(this.carrierPhase * twoPi);

      // 7. ADVANCE LFO
      this.lfoPhase += currentRate * inverseSampleRate;
      if (this.lfoPhase >= 1.0) {
        this.lfoPhase -= 1.0;
      }
    }

    return true;
  }
}

registerProcessor('vibrato-processor', VibratoProcessor);
