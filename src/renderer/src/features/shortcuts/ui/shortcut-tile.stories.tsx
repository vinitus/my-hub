import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  SortableContext,
} from "@dnd-kit/sortable"
import { FolderIcon, GlobeIcon, MonitorIcon } from "lucide-react"
import { ShortcutTile, SortableShortcutTile } from "./shortcut-tile"
const item = {
  id: "11111111-1111-4111-8111-111111111111",
  kind: "website" as const,
  name: "프로젝트 문서",
  target: "https://example.com/docs",
}
const secondItem = {
  ...item,
  id: "22222222-2222-4222-8222-222222222222",
  name: "디자인 파일",
  target: "C:/Fixtures/Design.fig",
  kind: "program" as const,
}
const meta = {
  title: "바로가기/타일",
  component: ShortcutTile,
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
  args: {
    item,
    disabled: false,
    icon: <GlobeIcon />,
    onLaunch: () => {},
    onEdit: () => {},
    onDelete: () => {},
  },
} satisfies Meta<typeof ShortcutTile>
export default meta
type Story = StoryObj<typeof meta>
function ReorderableFixture() {
  const [items, setItems] = useState([item, secondItem])
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={({ active, over }) => {
        if (!over || active.id === over.id) return
        setItems((current) =>
          arrayMove(
            current,
            current.findIndex((entry) => entry.id === active.id),
            current.findIndex((entry) => entry.id === over.id)
          )
        )
      }}
    >
      <SortableContext
        items={items.map((entry) => entry.id)}
        strategy={rectSortingStrategy}
      >
        <div
          className="grid w-[26rem] gap-3"
          data-testid="reorderable-shortcuts"
          data-order={items.map((entry) => entry.name).join(",")}
        >
          {items.map((entry) => (
            <SortableShortcutTile
              key={entry.id}
              item={entry}
              disabled={false}
              sortable
              icon={<GlobeIcon />}
              onLaunch={() => {}}
              onEdit={() => {}}
              onDelete={() => {}}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
export const Website: Story = {}
export const Reorderable: Story = { render: () => <ReorderableFixture /> }
export const Folder: Story = {
  args: {
    item: {
      ...item,
      kind: "folder",
      target: "C:/Fixtures/Projects/Long folder name",
    },
    icon: <FolderIcon />,
  },
}
export const Program: Story = {
  args: {
    item: { ...item, kind: "program", target: "C:/Fixtures/Editor.lnk" },
    icon: <MonitorIcon />,
  },
}
export const NoIcon: Story = { args: { icon: null } }
export const LongName: Story = {
  args: {
    item: {
      ...item,
      name: "아주 긴 프로젝트의 문서와 작업 폴더를 여는 바로가기",
    },
  },
}
export const Disabled: Story = { args: { disabled: true } }
