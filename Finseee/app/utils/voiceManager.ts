import { Audio } from 'expo-av';

class VoiceManager {
  private static instance: VoiceManager;
  private recording: Audio.Recording | null = null;
  private _isRecording = false;
  private silenceTimer: NodeJS.Timeout | null = null;
  private onSilenceCallback: (() => void) | null = null;
  private isSpeaking = false;

  private constructor() {}

  static getInstance(): VoiceManager {
    if (!VoiceManager.instance) {
      VoiceManager.instance = new VoiceManager();
    }
    return VoiceManager.instance;
  }

  get isRecording(): boolean {
    return this._isRecording;
  }

  async startRecording(onSilence: () => void): Promise<void> {
    if (this._isRecording) {
      console.log('Already recording');
      return;
    }

    try {
      await this.setupRecording();
      this.onSilenceCallback = onSilence;
      this._isRecording = true;
      
      const { recording } = await Audio.Recording.createAsync({
        android: {
          extension: '.wav',
          sampleRate: 16000,
          numberOfChannels: 1,
          audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_AAC,
        },
        ios: {
          extension: '.wav',
          sampleRate: 16000,
          numberOfChannels: 1,
          audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_HIGH,
        },
      });

      this.recording = recording;
    } catch (error) {
      console.error('Failed to start recording', error);
      this._isRecording = false;
      throw error;
    }
  }

  private async setupRecording(): Promise<void> {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
    } catch (error) {
      console.error('Failed to setup recording', error);
      throw error;
    }
  }

  async stopRecording(): Promise<string | null> {
    if (!this.recording || !this._isRecording) return null;

    try {
      this._isRecording = false;
      await this.recording.stopAndUnloadAsync();
      const uri = this.recording.getURI();
      this.recording = null;

      if (this.onSilenceCallback) {
        this.onSilenceCallback();
      }

      return uri;
    } catch (error) {
      console.error('Failed to stop recording', error);
      return null;
    }
  }

  async cleanup(): Promise<void> {
    if (this.recording) {
      await this.recording.stopAndUnloadAsync();
    }
    this.recording = null;
    this._isRecording = false;
  }

  async waitForSpeechToFinish(): Promise<void> {
    while (this.isSpeaking) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  setSpeaking(speaking: boolean) {
    this.isSpeaking = speaking;
  }
}

export default VoiceManager;
