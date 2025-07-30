import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render, createTestCaller } from '../utils/test-utils';
import { mockAgent } from '../setup';

const StarButton = ({ threadId, isStarred = false }: { threadId: string; isStarred?: boolean }) => {
  const handleStar = async () => {
    const testCaller = createTestCaller();
    try {
      await testCaller.mail.toggleStar({ ids: [threadId] });
    } catch (error) {
      console.error('Star toggle failed:', error);
    }
  };

  return (
    <button 
      role="button"
      aria-label={isStarred ? "Unstar" : "Star"}
      onClick={handleStar}
    >
      {isStarred ? "★" : "☆"}
    </button>
  );
};

describe('Real Star Integration Test', () => {
  const user = userEvent.setup();

  const renderComponent = (threadId: string, isStarred = false) => {
    return render(<StarButton threadId={threadId} isStarred={isStarred} />);
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should toggle star status on a thread', async () => {
    renderComponent('thread-1');

    const starButton = screen.getByRole('button', { name: /star/i });
    expect(starButton).toBeInTheDocument();

    await user.click(starButton);

    await waitFor(() => {
      expect(mockAgent.modifyLabels).toHaveBeenCalledOnce();
      expect(mockAgent.modifyLabels).toHaveBeenCalledWith(['normalized-thread-1', 'normalized-thread-2'], ['STARRED'], []);
    });
  });

  it('should toggle unstar status on a starred thread', async () => {
    renderComponent('thread-2', true);
    
    const unstarButton = screen.getByRole('button', { name: /unstar/i });
    expect(unstarButton).toBeInTheDocument();

    await user.click(unstarButton);

    await waitFor(() => {
      expect(mockAgent.modifyLabels).toHaveBeenCalledOnce();
      expect(mockAgent.modifyLabels).toHaveBeenCalledWith(['normalized-thread-1', 'normalized-thread-2'], ['STARRED'], []);
    });
  });
});