import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Bell, Plus } from 'lucide-react';

import { Badge } from './Badge';
import { Button, ButtonAnchor, ButtonLink, IconButton, buttonClasses } from './Button';
import { Callout } from './Callout';
import { Card, CardBody, CardFooter, CardHeader } from './Card';
import { Checkbox, Switch } from './Checkbox';
import { Drawer } from './Drawer';
import { Field, FieldGroup } from './Field';
import { Input, SearchInput, Select, Textarea } from './Input';
import { Menu, MenuHeader, MenuItem, MenuLabel, MenuSeparator } from './Menu';
import { PageHeader, SectionHeader } from './PageHeader';
import { ProgressBar } from './ProgressBar';
import { SegmentedControl } from './SegmentedControl';
import { Skeleton } from './Skeleton';
import { Metric, StatCard } from './StatCard';
import StatusBadge from './StatusBadge';
import { Table, TBody, TD, TH, THead, TR } from './Table';
import { Tabs } from './Tabs';
import CourseThumbnail from './CourseThumbnail';
import { Logo } from './Logo';

describe('buttons', () => {
  test('a loading button is busy and cannot be pressed twice', () => {
    const onClick = jest.fn();
    render(<Button loading onClick={onClick}>Save</Button>);

    const button = screen.getByRole('button', { name: /Save/ });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  test('a button is a button unless it says otherwise, and takes its variant', () => {
    render(<Button variant="danger" icon={Plus}>Delete</Button>);

    const button = screen.getByRole('button', { name: 'Delete' });
    expect(button).toHaveAttribute('type', 'button');
    expect(button.className).toContain('bg-danger');
  });

  test('links that look like buttons keep their hover colour (a link is never "disabled")', () => {
    render(
      <MemoryRouter>
        <ButtonLink to="/student/explore" variant="secondary">Browse</ButtonLink>
        <ButtonAnchor href="https://example.com/file.pdf">Open</ButtonAnchor>
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: 'Browse' })).toHaveAttribute('href', '/student/explore');
    expect(screen.getByRole('link', { name: 'Open' })).toHaveAttribute('href', 'https://example.com/file.pdf');
    expect(buttonClasses({ variant: 'primary' }, 'link')).toContain('hover:bg-primary-hover');
    expect(buttonClasses({ variant: 'primary' })).toContain('enabled:hover:bg-primary-hover');
  });

  test('an icon button is named by its label and shows its count', () => {
    render(<IconButton icon={Bell} label="Notifications" badge={3} />);

    expect(screen.getByRole('button', { name: 'Notifications' })).toHaveTextContent('3');
  });
});

describe('form controls', () => {
  test('a field ties its label, its hint and its error to the control', () => {
    render(
      <Field label="Price" hint="In dollars" error="Too high" required>
        <Input />
      </Field>
    );

    const input = screen.getByRole('textbox', { name: /Price/ });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-required', 'true');
    expect(input).toHaveAccessibleDescription('Too high');
    // the error takes the place of the hint
    expect(screen.queryByText('In dollars')).not.toBeInTheDocument();
  });

  test('a hint describes the control while there is no error', () => {
    render(
      <Field label="Name" hint="Shown on the checkout page">
        <Textarea />
      </Field>
    );

    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveAccessibleDescription('Shown on the checkout page');
  });

  test('a select and an input with an icon keep their own controls', () => {
    render(
      <>
        <Field label="Level">
          <Select defaultValue="b">
            <option value="a">A</option>
            <option value="b">B</option>
          </Select>
        </Field>
        <Field label="Search">
          <Input icon={Bell} />
        </Field>
        <FieldGroup legend="Theme" description="How it looks">
          <span>options</span>
        </FieldGroup>
      </>
    );

    expect(screen.getByRole('combobox', { name: 'Level' })).toHaveValue('b');
    expect(screen.getByRole('textbox', { name: 'Search' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Theme' })).toHaveTextContent('options');
  });

  test('a search box can be cleared', () => {
    const Search = () => {
      const [value, setValue] = useState('python');
      return <SearchInput label="Search courses" value={value} onChange={setValue} />;
    };
    render(<Search />);

    expect(screen.getByRole('searchbox', { name: 'Search courses' })).toHaveValue('python');
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(screen.getByRole('searchbox', { name: 'Search courses' })).toHaveValue('');
    expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument();
  });

  test('a checkbox is labelled and a switch says whether it is on', () => {
    const onChange = jest.fn();
    render(
      <>
        <Checkbox label="Allow late submissions" description="After the due date" />
        <Switch label="Maintenance" checked={false} onChange={onChange} />
      </>
    );

    fireEvent.click(screen.getByLabelText(/Allow late submissions/));
    expect(screen.getByRole('checkbox', { name: /Allow late submissions/ })).toBeChecked();

    const toggle = screen.getByRole('switch', { name: 'Maintenance' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(toggle);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe('choosing', () => {
  const Choice = () => {
    const [value, setValue] = useState<'url' | 'upload'>('url');
    return (
      <>
        <SegmentedControl
          label="Video source"
          value={value}
          onChange={setValue}
          options={[{ value: 'url', label: 'A link' }, { value: 'upload', label: 'A file', description: 'MP4' }]}
        />
        <p>chosen: {value}</p>
      </>
    );
  };

  test('one option of a segmented control is checked, a click or an arrow moves it', () => {
    render(<Choice />);

    expect(screen.getByRole('radio', { name: 'A link' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('radio', { name: 'A file' }));
    expect(screen.getByText('chosen: upload')).toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole('radio', { name: 'A file' }), { key: 'ArrowRight' });
    expect(screen.getByText('chosen: url')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'A link' })).toHaveFocus();
  });

  const Views = () => {
    const [value, setValue] = useState<'active' | 'completed' | 'all'>('active');
    return (
      <Tabs
        label="Show"
        value={value}
        onChange={setValue}
        items={[
          { value: 'active', label: 'In Progress', count: 4 },
          { value: 'completed', label: 'Completed', count: 1 },
          { value: 'all', label: 'All Courses' },
        ]}
      />
    );
  };

  test('tabs: one is selected, the arrow keys move along the list and wrap around', () => {
    render(<Views />);

    expect(screen.getByRole('tab', { name: /In Progress/ })).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(screen.getByRole('tab', { name: /In Progress/ }), { key: 'ArrowLeft' });
    expect(screen.getByRole('tab', { name: 'All Courses' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('tab', { name: /Completed/ }));
    expect(screen.getByRole('tab', { name: /Completed/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tablist', { name: 'Show' })).toBeInTheDocument();
  });
});

describe('the account menu', () => {
  const renderMenu = (onSelect = jest.fn()) =>
    render(
      <MemoryRouter>
        <Menu label="Account menu" button={<span>DS</span>}>
          <MenuHeader>Demo Student</MenuHeader>
          <MenuSeparator />
          <MenuItem to="/student/account">Account settings</MenuItem>
          <MenuLabel>Theme</MenuLabel>
          <MenuItem checked onSelect={onSelect}>Light</MenuItem>
          <MenuItem checked={false} onSelect={onSelect}>Dark</MenuItem>
          <MenuItem tone="danger" onSelect={onSelect}>Log out</MenuItem>
        </Menu>
      </MemoryRouter>
    );

  test('opens on a click with the first item focused, and closes on Escape', () => {
    renderMenu();
    const button = screen.getByRole('button', { name: 'Account menu' });
    expect(button).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(button);

    expect(screen.getByRole('menu', { name: 'Account menu' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Account settings' })).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });

  test('the arrow keys move between items; choosing one closes the menu', () => {
    const onSelect = jest.fn();
    renderMenu(onSelect);
    fireEvent.click(screen.getByRole('button', { name: 'Account menu' }));
    const menu = screen.getByRole('menu');

    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(screen.getByRole('menuitemradio', { name: 'Light' })).toHaveFocus();
    expect(screen.getByRole('menuitemradio', { name: 'Light' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.keyDown(menu, { key: 'End' });
    expect(screen.getByRole('menuitem', { name: 'Log out' })).toHaveFocus();
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(screen.getByRole('menuitem', { name: 'Account settings' })).toHaveFocus();
    fireEvent.keyDown(menu, { key: 'ArrowUp' });
    fireEvent.keyDown(menu, { key: 'Home' });

    fireEvent.click(screen.getByRole('menuitem', { name: 'Log out' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  test('a click outside closes it', () => {
    renderMenu();
    fireEvent.click(screen.getByRole('button', { name: 'Account menu' }));

    fireEvent.mouseDown(document.body);

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});

describe('a drawer', () => {
  test('is a named dialog that Escape closes', () => {
    const onClose = jest.fn();
    render(
      <Drawer label="Navigation" onClose={onClose}>
        <a href="/student">Home</a>
      </Drawer>
    );

    expect(screen.getByRole('dialog', { name: 'Navigation' })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('figures and panels', () => {
  test('a stat card is a group named after its figure, label before value', () => {
    render(<StatCard label="Courses Enrolled" value={5} hint="4 in progress" icon={Bell} tone="success" />);

    expect(screen.getByRole('group', { name: 'Courses Enrolled' })).toHaveTextContent(/Courses Enrolled\s*5\s*4 in progress/);
  });

  test('a metric is the number over its name', () => {
    render(<Metric label="Grade Weight" value="90%" tone="danger" />);

    expect(screen.getByText('90%')).toBeInTheDocument();
    expect(screen.getByText('Grade Weight')).toBeInTheDocument();
  });

  test('a progress bar says how far, clamped to its range', () => {
    render(
      <>
        <ProgressBar value={140} label="Course progress" />
        <ProgressBar value={-3} max={10} label="Weight" tone="danger" size="xs" />
      </>
    );

    expect(screen.getByRole('progressbar', { name: 'Course progress' })).toHaveAttribute('aria-valuenow', '100');
    expect(screen.getByRole('progressbar', { name: 'Weight' })).toHaveAttribute('aria-valuenow', '0');
  });

  test('callouts, badges, headers and cards render what they are given', () => {
    render(
      <MemoryRouter>
        <PageHeader title="Revenue" description="Plus memberships" eyebrow="Business" actions={<button>Export</button>} />
        <SectionHeader title="Monthly" description="By month" action={<button>More</button>} />
        <Callout tone="warning" title="Careful" role="alert" action={<button>Undo</button>}>
          Something changed
        </Callout>
        <Callout tone="danger" icon={null}>No icon</Callout>
        <Badge tone="plus" dot>Plus</Badge>
        <StatusBadge status="pending_review" />
        <StatusBadge status="archived" />
        <Card as="article" aria-label="A card" interactive padded>
          <CardHeader title="Title" description="Description" icon={Bell} action={<button>Act</button>} as="h3" />
          <CardBody>Body</CardBody>
          <CardFooter>Footer</CardFooter>
        </Card>
        <Skeleton className="h-4" />
        <Logo compact />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Revenue' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Monthly' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/Careful\s*Something changed/);
    expect(screen.getByText('Pending Review')).toBeInTheDocument();
    // a status this app does not know is shown as it is
    expect(screen.getByText('archived')).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'A card' })).toHaveTextContent(/Title\s*Description/);
    expect(screen.getByRole('img', { name: 'Coursera Clone' })).toBeInTheDocument();
  });

  test('a table keeps one cell style and a course without a picture gets the placeholder', () => {
    render(
      <>
        <Table label="Users">
          <THead>
            <tr>
              <TH>Name</TH>
              <TH align="right">Courses</TH>
            </tr>
          </THead>
          <TBody>
            <TR>
              <TD>Ada</TD>
              <TD align="right">3</TD>
            </TR>
          </TBody>
        </Table>
        <CourseThumbnail course={{ title: 'Python', thumbnail: null }} />
        <CourseThumbnail course={{ title: 'React', thumbnail: '/media/react.png' }} />
      </>
    );

    expect(screen.getByRole('table', { name: 'Users' })).toHaveTextContent(/Name\s*Courses\s*Ada\s*3/);
    expect(screen.getByRole('img', { name: 'Python' }).tagName).toBe('DIV');
    const picture = screen.getByRole('img', { name: 'React' });
    expect(picture.tagName).toBe('IMG');
    // a file that does not load falls back to the placeholder
    fireEvent.error(picture);
    expect(screen.getByRole('img', { name: 'React' }).tagName).toBe('DIV');
  });
});
