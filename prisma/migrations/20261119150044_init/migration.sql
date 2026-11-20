-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "login" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'kk',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "schoolId" TEXT,
    "lastLoginAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "School" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SchoolClass" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "grade" INTEGER NOT NULL,
    "academicYear" TEXT NOT NULL,
    "inviteCode" TEXT NOT NULL,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SchoolClass_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SchoolClass_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClassMember" (
    "classId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("classId", "studentId"),
    CONSTRAINT "ClassMember_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SchoolClass" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClassMember_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ParentLink" (
    "parentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("parentId", "studentId"),
    CONSTRAINT "ParentLink_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ParentLink_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "City" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "materials" INTEGER NOT NULL DEFAULT 0,
    "stars" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "City_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BuildingType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "nameKk" TEXT NOT NULL,
    "nameRu" TEXT NOT NULL,
    "areaKk" TEXT NOT NULL,
    "areaRu" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "mapCol" INTEGER NOT NULL,
    "mapRow" INTEGER NOT NULL,
    "isCore" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "ClassBuildingConfig" (
    "classId" TEXT NOT NULL,
    "buildingTypeId" TEXT NOT NULL,
    "unlockOrder" INTEGER NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "scoringMode" TEXT NOT NULL DEFAULT 'BEST',
    "unlockAfterId" TEXT,
    "unlockMinLevel" INTEGER NOT NULL DEFAULT 2,

    PRIMARY KEY ("classId", "buildingTypeId"),
    CONSTRAINT "ClassBuildingConfig_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SchoolClass" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClassBuildingConfig_buildingTypeId_fkey" FOREIGN KEY ("buildingTypeId") REFERENCES "BuildingType" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClassBuildingConfig_unlockAfterId_fkey" FOREIGN KEY ("unlockAfterId") REFERENCES "BuildingType" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BuildingProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cityId" TEXT NOT NULL,
    "buildingTypeId" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 0,
    "score" REAL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BuildingProgress_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BuildingProgress_buildingTypeId_fkey" FOREIGN KEY ("buildingTypeId") REFERENCES "BuildingType" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BuildingLevelEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "progressId" TEXT NOT NULL,
    "fromLevel" INTEGER NOT NULL,
    "toLevel" INTEGER NOT NULL,
    "score" REAL NOT NULL,
    "attemptId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BuildingLevelEvent_progressId_fkey" FOREIGN KEY ("progressId") REFERENCES "BuildingProgress" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BuildingLevelEvent_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Topic" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "authorId" TEXT NOT NULL,
    "buildingTypeId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Topic_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Topic_buildingTypeId_fkey" FOREIGN KEY ("buildingTypeId") REFERENCES "BuildingType" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "authorId" TEXT NOT NULL,
    "topicId" TEXT,
    "buildingTypeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "grading" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "instruction" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "answerKey" JSONB,
    "explanation" TEXT,
    "criteria" JSONB,
    "difficulty" INTEGER NOT NULL DEFAULT 2,
    "timeLimitSec" INTEGER,
    "maxAttempts" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Task_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Task_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_buildingTypeId_fkey" FOREIGN KEY ("buildingTypeId") REFERENCES "BuildingType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TaskAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "classId" TEXT,
    "studentId" TEXT,
    "assignedById" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "deadline" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaskAssignment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaskAssignment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SchoolClass" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaskAssignment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaskAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AttemptAllowance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "extraAttempts" INTEGER NOT NULL DEFAULT 1,
    "grantedById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AttemptAllowance_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AttemptAllowance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AttemptAllowance_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT,
    "uploadedById" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "filePath" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Material_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Material_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Attempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "answers" JSONB NOT NULL,
    "result" JSONB,
    "autoScore" REAL,
    "manualScore" REAL,
    "rubric" JSONB,
    "score" REAL,
    "feedback" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" DATETIME,
    "gradedAt" DATETIME,
    "gradedById" TEXT,
    CONSTRAINT "Attempt_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Attempt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Attempt_gradedById_fkey" FOREIGN KEY ("gradedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RewardTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "attemptId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RewardTransaction_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RewardTransaction_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Achievement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "nameKk" TEXT NOT NULL,
    "nameRu" TEXT NOT NULL,
    "descriptionKk" TEXT NOT NULL,
    "descriptionRu" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "rule" JSONB NOT NULL,
    "sortOrder" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "StudentAchievement" (
    "studentId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "earnedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("studentId", "achievementId"),
    CONSTRAINT "StudentAchievement_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudentAchievement_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "Achievement" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Decoration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "nameKk" TEXT NOT NULL,
    "nameRu" TEXT NOT NULL,
    "costMaterials" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "CityDecoration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cityId" TEXT NOT NULL,
    "decorationId" TEXT NOT NULL,
    "x" INTEGER,
    "y" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CityDecoration_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CityDecoration_decorationId_fkey" FOREIGN KEY ("decorationId") REFERENCES "Decoration" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recipientId" TEXT NOT NULL,
    "subjectId" TEXT,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Notification_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CertificatePolicy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "classId" TEXT,
    "bronzeMin" REAL NOT NULL DEFAULT 6,
    "silverMin" REAL NOT NULL DEFAULT 7.5,
    "goldMin" REAL NOT NULL DEFAULT 8.5,
    "platinumMin" REAL NOT NULL DEFAULT 9.5,
    "minBuildingLevel" INTEGER NOT NULL DEFAULT 3,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CertificatePolicy_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SchoolClass" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CertificateTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "titleKk" TEXT NOT NULL,
    "titleRu" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "design" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Certificate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "serial" TEXT NOT NULL,
    "verifyCode" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "classId" TEXT,
    "templateId" TEXT,
    "tier" TEXT NOT NULL,
    "finalScore" REAL NOT NULL,
    "snapshot" JSONB NOT NULL,
    "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" DATETIME,
    CONSTRAINT "Certificate_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Certificate_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SchoolClass" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Certificate_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CertificateTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlatformSetting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" JSONB NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "data" JSONB,
    "ip" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ErrorLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "context" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "User_login_key" ON "User"("login");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_schoolId_idx" ON "User"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolClass_inviteCode_key" ON "SchoolClass"("inviteCode");

-- CreateIndex
CREATE INDEX "SchoolClass_teacherId_idx" ON "SchoolClass"("teacherId");

-- CreateIndex
CREATE INDEX "SchoolClass_schoolId_idx" ON "SchoolClass"("schoolId");

-- CreateIndex
CREATE INDEX "ClassMember_studentId_idx" ON "ClassMember"("studentId");

-- CreateIndex
CREATE INDEX "ParentLink_studentId_idx" ON "ParentLink"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "City_studentId_key" ON "City"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "BuildingType_key_key" ON "BuildingType"("key");

-- CreateIndex
CREATE UNIQUE INDEX "BuildingProgress_cityId_buildingTypeId_key" ON "BuildingProgress"("cityId", "buildingTypeId");

-- CreateIndex
CREATE INDEX "BuildingLevelEvent_progressId_createdAt_idx" ON "BuildingLevelEvent"("progressId", "createdAt");

-- CreateIndex
CREATE INDEX "Topic_authorId_idx" ON "Topic"("authorId");

-- CreateIndex
CREATE INDEX "Task_buildingTypeId_idx" ON "Task"("buildingTypeId");

-- CreateIndex
CREATE INDEX "Task_authorId_idx" ON "Task"("authorId");

-- CreateIndex
CREATE INDEX "Task_topicId_idx" ON "Task"("topicId");

-- CreateIndex
CREATE INDEX "TaskAssignment_classId_idx" ON "TaskAssignment"("classId");

-- CreateIndex
CREATE INDEX "TaskAssignment_studentId_idx" ON "TaskAssignment"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskAssignment_taskId_classId_key" ON "TaskAssignment"("taskId", "classId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskAssignment_taskId_studentId_key" ON "TaskAssignment"("taskId", "studentId");

-- CreateIndex
CREATE INDEX "AttemptAllowance_taskId_studentId_idx" ON "AttemptAllowance"("taskId", "studentId");

-- CreateIndex
CREATE INDEX "Material_taskId_idx" ON "Material"("taskId");

-- CreateIndex
CREATE INDEX "Attempt_studentId_status_idx" ON "Attempt"("studentId", "status");

-- CreateIndex
CREATE INDEX "Attempt_status_idx" ON "Attempt"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Attempt_taskId_studentId_number_key" ON "Attempt"("taskId", "studentId", "number");

-- CreateIndex
CREATE INDEX "RewardTransaction_studentId_createdAt_idx" ON "RewardTransaction"("studentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Achievement_key_key" ON "Achievement"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Decoration_key_key" ON "Decoration"("key");

-- CreateIndex
CREATE INDEX "CityDecoration_cityId_idx" ON "CityDecoration"("cityId");

-- CreateIndex
CREATE INDEX "Notification_recipientId_readAt_idx" ON "Notification"("recipientId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "CertificatePolicy_classId_key" ON "CertificatePolicy"("classId");

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_serial_key" ON "Certificate"("serial");

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_verifyCode_key" ON "Certificate"("verifyCode");

-- CreateIndex
CREATE INDEX "Certificate_studentId_idx" ON "Certificate"("studentId");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "ErrorLog_createdAt_idx" ON "ErrorLog"("createdAt");
