export interface BiasedAdjective {
  phrase: string;
  alternative: string;
  explanation: string;
}

export interface FramingData {
  headline: string;
  outletName: string;
  storyText: string;
  adjectives: BiasedAdjective[];
  omittedFacts: string[];
}

export interface BiasStory {
  id: string;
  title: string;
  category: string;
  neutralSummary: string[];
  leftFraming: FramingData;
  rightFraming: FramingData;
  date?: string;
  isCustom?: boolean;
}
