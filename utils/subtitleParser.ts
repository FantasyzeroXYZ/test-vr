import { SubtitleCue } from '../types';

export const parseSRT = (srtContent: string): SubtitleCue[] => {
  const cues: SubtitleCue[] = [];
  const blocks = srtContent.trim().split(/\n\s*\n/);

  blocks.forEach((block, index) => {
    const lines = block.split('\n');
    if (lines.length < 3) return;

    // Sometimes the index 0 is the ID, sometimes ID is omitted or merged. 
    // Standard SRT: Line 1 ID, Line 2 Time, Line 3+ Text
    let timeLineIndex = 1;
    if (!lines[0].match(/\d+/)) {
        // If first line isn't just a number, maybe it's the time line (malformed)
        timeLineIndex = 0;
    } else if (lines[1].indexOf('-->') === -1) {
       // ID present
       timeLineIndex = 1;
    }

    const timeLine = lines[timeLineIndex];
    if (!timeLine || timeLine.indexOf('-->') === -1) return;

    const [startStr, endStr] = timeLine.split('-->').map(s => s.trim());
    const startTime = timeStringToSeconds(startStr);
    const endTime = timeStringToSeconds(endStr);

    // Join remaining lines as text
    const textLines = lines.slice(timeLineIndex + 1);
    const rawText = textLines.join(' ').replace(/<[^>]*>/g, ''); // Remove HTML tags if any

    // Simple word tokenizer keeping punctuation separate usually helps, 
    // but for gaze targeting we want clickable words.
    // We split by spaces but clean punctuation for the "value"
    const parsedWords = rawText.split(/\s+/);

    cues.push({
      id: `cue-${index}`,
      startTime,
      endTime,
      text: rawText,
      parsedWords
    });
  });

  return cues;
};

const timeStringToSeconds = (timeString: string): number => {
  const parts = timeString.split(':');
  const secondsParts = parts[2].split(',');
  
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  const seconds = parseInt(secondsParts[0], 10);
  const milliseconds = parseInt(secondsParts[1], 10);

  return (hours * 3600) + (minutes * 60) + seconds + (milliseconds / 1000);
};

export const SAMPLE_SRT = `1
00:00:01,000 --> 00:00:05,000
Welcome to the future of language learning in virtual reality.

2
00:00:05,500 --> 00:00:09,000
Simply look at a word to understand its meaning.

3
00:00:09,500 --> 00:00:14,000
The sky is blue, the grass is green, and technology is amazing.
`;