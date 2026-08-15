import React from 'react';
import { Composition } from 'remotion';
import { LoadingLoop } from './LoadingLoop';
import { LOADING_LOOP } from './theme';

export const RemotionRoot: React.FC = () => {
    return (
        <Composition
            id="LoadingLoop"
            component={LoadingLoop}
            durationInFrames={LOADING_LOOP.durationInFrames}
            fps={LOADING_LOOP.fps}
            width={LOADING_LOOP.size}
            height={LOADING_LOOP.size}
        />
    );
};
