/**
 * Frontend Components Integration Tests
 * 
 * Tests for React components in the Cleaner AI Settings Suite
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';

// Import components (adjust paths as needed)
import SettingsCard from '../../admin-portal/components/SettingsCard';
import TemplateEditor from '../../admin-portal/components/TemplateEditor';
import QuickResponseManager from '../../admin-portal/components/QuickResponseManager';
import AIPersonalityWizard from '../../admin-portal/components/AIPersonalityWizard';
import InsightsDashboard from '../../admin-portal/components/InsightsDashboard';

describe('SettingsCard Component', () => {
  it('should render with title and description', () => {
    render(
      <SettingsCard
        title="Test Setting"
        description="This is a test setting"
        value={true}
        onChange={() => {}}
      />
    );

    expect(screen.getByText('Test Setting')).toBeInTheDocument();
    expect(screen.getByText('This is a test setting')).toBeInTheDocument();
  });

  it('should toggle boolean value', async () => {
    const mockOnChange = jest.fn();
    render(
      <SettingsCard
        title="Test Setting"
        value={false}
        type="boolean"
        onChange={mockOnChange}
      />
    );

    const toggle = screen.getByRole('button');
    fireEvent.click(toggle);

    expect(mockOnChange).toHaveBeenCalledWith(true);
  });

  it('should handle number input', async () => {
    const mockOnChange = jest.fn();
    render(
      <SettingsCard
        title="Number Setting"
        value={5}
        type="number"
        onChange={mockOnChange}
        min={0}
        max={10}
      />
    );

    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '7' } });

    expect(mockOnChange).toHaveBeenCalledWith(7);
  });

  it('should render select options', () => {
    const options = [
      { value: 'option1', label: 'Option 1' },
      { value: 'option2', label: 'Option 2' },
    ];

    render(
      <SettingsCard
        title="Select Setting"
        value="option1"
        type="select"
        options={options}
        onChange={() => {}}
      />
    );

    expect(screen.getByText('Option 1')).toBeInTheDocument();
    expect(screen.getByText('Option 2')).toBeInTheDocument();
  });

  it('should display badge when provided', () => {
    render(
      <SettingsCard
        title="Test Setting"
        value={true}
        badge="NEW"
        onChange={() => {}}
      />
    );

    expect(screen.getByText('NEW')).toBeInTheDocument();
  });

  it('should be disabled when enabled is false', () => {
    render(
      <SettingsCard
        title="Disabled Setting"
        value={true}
        enabled={false}
        onChange={() => {}}
      />
    );

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });
});

describe('TemplateEditor Component', () => {
  const mockOnSave = jest.fn().mockResolvedValue(undefined);
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render empty editor for new template', () => {
    render(
      <TemplateEditor
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText('Create New Template')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/write your message/i)).toBeInTheDocument();
  });

  it('should populate editor with existing template data', () => {
    const template = {
      id: '123',
      type: 'booking_confirmation',
      name: 'Test Template',
      content: 'Hi {client_name}!',
      variables: ['client_name'],
      active: true,
    };

    render(
      <TemplateEditor
        template={template}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText('Edit Template')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Test Template')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Hi {client_name}!')).toBeInTheDocument();
  });

  it('should insert variable when clicked', async () => {
    render(
      <TemplateEditor
        onSave={mockOnSave}
        onCancel={mockOnCancel}
        availableVariables={['client_name', 'date']}
      />
    );

    const clientNameButton = screen.getByText('+ client_name');
    fireEvent.click(clientNameButton);

    // Variable should be inserted into the content
    await waitFor(() => {
      const textarea = screen.getByPlaceholderText(/write your message/i);
      expect(textarea).toHaveValue(expect.stringContaining('{client_name}'));
    });
  });

  it('should update character count', async () => {
    render(
      <TemplateEditor
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    const textarea = screen.getByPlaceholderText(/write your message/i);
    await userEvent.type(textarea, 'Test content');

    expect(screen.getByText(/12 \/ 1000/)).toBeInTheDocument();
  });

  it('should validate required fields', async () => {
    render(
      <TemplateEditor
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    const saveButton = screen.getByText('Create Template');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Template name is required')).toBeInTheDocument();
      expect(screen.getByText('Template content is required')).toBeInTheDocument();
    });

    expect(mockOnSave).not.toHaveBeenCalled();
  });

  it('should call onSave with form data', async () => {
    render(
      <TemplateEditor
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    await userEvent.type(screen.getByPlaceholderText(/my booking/i), 'Test Template');
    await userEvent.type(screen.getByPlaceholderText(/write your message/i), 'Test content');

    const saveButton = screen.getByText('Create Template');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Template',
          content: 'Test content',
        })
      );
    });
  });

  it('should call onCancel when cancel is clicked', () => {
    render(
      <TemplateEditor
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('should generate preview with sample data', async () => {
    render(
      <TemplateEditor
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    const textarea = screen.getByPlaceholderText(/write your message/i);
    await userEvent.type(textarea, 'Hi {client_name}, see you at {time}!');

    // Preview should update automatically
    expect(screen.getByText(/your preview will appear here/i)).toBeInTheDocument();
  });
});

describe('AIPersonalityWizard Component', () => {
  const mockOnComplete = jest.fn().mockResolvedValue(undefined);
  const mockOnSkip = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render wizard steps', () => {
    render(
      <AIPersonalityWizard
        onComplete={mockOnComplete}
        onSkip={mockOnSkip}
      />
    );

    expect(screen.getByText('AI Personality Setup Wizard')).toBeInTheDocument();
    expect(screen.getByText('Communication Tone')).toBeInTheDocument();
  });

  it('should navigate between steps', async () => {
    render(
      <AIPersonalityWizard
        onComplete={mockOnComplete}
        onSkip={mockOnSkip}
      />
    );

    // Should be on first step
    expect(screen.getByText(/how should your ai assistant communicate/i)).toBeInTheDocument();

    // Click continue
    const continueButton = screen.getByText('Continue →');
    fireEvent.click(continueButton);

    await waitFor(() => {
      expect(screen.getByText('Automation Level')).toBeInTheDocument();
    });

    // Click back
    const backButton = screen.getByText('← Back');
    fireEvent.click(backButton);

    await waitFor(() => {
      expect(screen.getByText(/how should your ai assistant communicate/i)).toBeInTheDocument();
    });
  });

  it('should allow selecting communication tone', async () => {
    render(
      <AIPersonalityWizard
        onComplete={mockOnComplete}
        onSkip={mockOnSkip}
      />
    );

    const professionalButton = screen.getByText('Professional');
    fireEvent.click(professionalButton);

    // Button should be selected (has blue border)
    expect(professionalButton.closest('button')).toHaveClass('border-blue-600');
  });

  it('should allow adjusting formality level', async () => {
    render(
      <AIPersonalityWizard
        onComplete={mockOnComplete}
        onSkip={mockOnSkip}
      />
    );

    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '5' } });

    expect(slider).toHaveValue('5');
  });

  it('should call onSkip when skip is clicked', () => {
    render(
      <AIPersonalityWizard
        onComplete={mockOnComplete}
        onSkip={mockOnSkip}
      />
    );

    const skipButton = screen.getByText('Skip for now');
    fireEvent.click(skipButton);

    expect(mockOnSkip).toHaveBeenCalled();
  });

  it('should complete wizard and call onComplete', async () => {
    render(
      <AIPersonalityWizard
        onComplete={mockOnComplete}
        onSkip={mockOnSkip}
      />
    );

    // Navigate through all steps
    for (let i = 0; i < 3; i++) {
      const continueButton = screen.getByText('Continue →');
      fireEvent.click(continueButton);
      await waitFor(() => {});
    }

    // Should be on review step
    expect(screen.getByText(/your ai personality is ready/i)).toBeInTheDocument();

    // Complete setup
    const completeButton = screen.getByText('🎉 Complete Setup');
    fireEvent.click(completeButton);

    await waitFor(() => {
      expect(mockOnComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          communicationTone: expect.any(String),
          formalityLevel: expect.any(Number),
        })
      );
    });
  });
});

describe('InsightsDashboard Component', () => {
  beforeEach(() => {
    // Mock fetch
    global.fetch = jest.fn(() =>
      Promise.resolve({
        json: () =>
          Promise.resolve({
            templates: [
              { template_type: 'booking_confirmation', count: 3, total_usage: 15 },
              { template_type: 'pre_cleaning_reminder', count: 2, total_usage: 10 },
            ],
            quickResponses: [
              { response_category: 'pricing', count: 2, total_usage: 8, favorites: 1 },
            ],
            settings: { enabled: 10, disabled: 2 },
            generatedAt: new Date().toISOString(),
          }),
      })
    ) as jest.Mock;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should display loading state', () => {
    render(<InsightsDashboard />);
    expect(screen.getByText('Loading insights...')).toBeInTheDocument();
  });

  it('should render insights data', async () => {
    render(<InsightsDashboard />);

    await waitFor(() => {
      expect(screen.getByText('AI Performance Insights')).toBeInTheDocument();
      expect(screen.getByText('Total AI Interactions')).toBeInTheDocument();
    });
  });

  it('should display template usage stats', async () => {
    render(<InsightsDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/booking confirmation/i)).toBeInTheDocument();
      expect(screen.getByText(/15 uses/)).toBeInTheDocument();
    });
  });

  it('should display quick response analytics', async () => {
    render(<InsightsDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/pricing/i)).toBeInTheDocument();
      expect(screen.getByText('8')).toBeInTheDocument();
    });
  });

  it('should refresh insights when refresh button is clicked', async () => {
    render(<InsightsDashboard />);

    await waitFor(() => {
      expect(screen.getByText('AI Performance Insights')).toBeInTheDocument();
    });

    const refreshButton = screen.getByText('🔄 Refresh');
    fireEvent.click(refreshButton);

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('should display recommendations', async () => {
    render(<InsightsDashboard />);

    await waitFor(() => {
      expect(screen.getByText('AI Recommendations')).toBeInTheDocument();
    });
  });
});

describe('Component Integration', () => {
  it('should work together in a complete flow', async () => {
    // This test simulates a user going through the entire setup process
    const mockOnComplete = jest.fn();
    const mockOnSkip = jest.fn();

    const { rerender } = render(
      <AIPersonalityWizard
        onComplete={mockOnComplete}
        onSkip={mockOnSkip}
      />
    );

    // Complete wizard
    for (let i = 0; i < 3; i++) {
      const continueButton = screen.getByText('Continue →');
      fireEvent.click(continueButton);
      await waitFor(() => {});
    }

    const completeButton = screen.getByText('🎉 Complete Setup');
    fireEvent.click(completeButton);

    await waitFor(() => {
      expect(mockOnComplete).toHaveBeenCalled();
    });

    // After setup, user should see settings
    rerender(
      <SettingsCard
        title="Booking Confirmation"
        value={true}
        onChange={() => {}}
      />
    );

    expect(screen.getByText('Booking Confirmation')).toBeInTheDocument();
  });
});

