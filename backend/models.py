from typing import Optional, List
from sqlmodel import SQLModel, Field, Relationship
from datetime import datetime



class ScheduledTaskAssignment(SQLModel, table=True):
    # This will mean different things for different chores vs task
    # i.e. Chores: A or B
    #       Task: a set for A and a set for B
    scheduled_task_id: int = Field(foreign_key="scheduledtask.id", primary_key=True)
    member_id: int = Field(foreign_key="familymember.id", primary_key=True)



class FamilyMember(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    age: int
    role: str  # "Parent", "Child", etc.
    avatar_url: Optional[str] = None

    # Relationships
    scheduled_tasks: List["ScheduledTask"] = Relationship(
        back_populates="assigned_to",
        link_model=ScheduledTaskAssignment
    )


class ScheduledTask(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str
    description: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None

    # "task" or "chore" or empty
    object_type: Optional[str] = None
    object_id: Optional[int] = None

    assigned_to: List["FamilyMember"] = Relationship(
        back_populates="scheduled_tasks",
        link_model=ScheduledTaskAssignment
    )

    def get_linked_object(self, session):
        if self.object_type and self.object_id:
            if self.object_type == "taskflow":
                return session.get(TaskFlow, self.object_id)
            elif self.object_type == "chore":
                return session.get(Chore, self.object_id)
        return None


class TaskFlow(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    description: Optional[str] = None
    task_items: List["TaskItem"] = Relationship(back_populates="taskflow")


class TaskItem(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str
    description: Optional[str] = None
    order: int
    completed_at: Optional[datetime] = None
    taskflow_id: int = Field(foreign_key="taskflow.id")
    taskflow: TaskFlow = Relationship(back_populates="task_items")



class Chore(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    room: Optional[str] = None
    effort: Optional[str] = None     # e.g., low, medium, high
    description: Optional[str] = None

