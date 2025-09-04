import React from 'react';
import { Spinner } from './index';
import styles from './FullPageSpinner.module.css';

interface FullPageSpinnerProps {
  text?: string;
  isVisible: boolean;
}

export default function FullPageSpinner({ text = 'Loading...', isVisible }: FullPageSpinnerProps) {
  if (!isVisible) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.content}>
        <Spinner size="lg" color="primary" text={text} />
      </div>
    </div>
  );
}
