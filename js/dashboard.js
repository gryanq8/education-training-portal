let currentUser = null;
let currentProfile = null;
let currentRoles = [];
let currentPermissions = [];
let departments = [];
let allContent = [];

const profileBox = document.getElementById("profileBox");
const logoutBtn = document.getElementById("logoutBtn");
const contentForm = document.getElementById("contentForm");
const formMessage = document.getElementById("formMessage");
const departmentSelect = document.getElementById("departmentId");
const contentTable = document.getElementById("contentTable");
const searchInput = document.getElementById("searchInput");
const filterType = document.getElementById("filterType");

document.addEventListener("DOMContentLoaded", initDashboard);
logoutBtn.addEventListener("click", logout);
contentForm.addEventListener("submit", saveContent);
searchInput.addEventListener("input", renderContentTable);
filterType.addEventListener("change", renderContentTable);

async function initDashboard() {
  const { data: sessionData } = await supabaseClient.auth.getSession();

  if (!sessionData.session) {
    window.location.href = "login.html";
    return;
  }

  currentUser = sessionData.session.user;

  await loadProfile();
  await loadDepartments();
  await loadRolesAndPermissions();
  await loadContent();

  renderProfile();
}

async function loadProfile() {
  const { data, error } = await supabaseClient
    .from("user_profiles")
    .select("*, departments(name_ar)")
    .eq("id", currentUser.id)
    .single();

  if (error) {
    profileBox.textContent = "تعذر جلب بيانات المستخدم. تأكد من ربط المستخدم في جدول user_profiles.";
    console.error(error);
    return;
  }

  currentProfile = data;
}

async function loadDepartments() {
  const { data, error } = await supabaseClient
    .from("departments")
    .select("*")
    .order("id", { ascending: true });

  if (error) {
    console.error(error);
    return;
  }

  departments = data || [];
  departmentSelect.innerHTML = departments
    .map((d) => `<option value="${d.id}">${d.name_ar}</option>`)
    .join("");
}

async function loadRolesAndPermissions() {
  const { data: roleRows, error: roleError } = await supabaseClient
    .from("user_roles")
    .select("roles(id, role_name, role_description)")
    .eq("user_id", currentUser.id);

  if (roleError) {
    console.error(roleError);
    return;
  }

  currentRoles = (roleRows || []).map((row) => row.roles).filter(Boolean);

  const roleIds = currentRoles.map((role) => role.id);
  if (roleIds.length === 0) return;

  const { data: permissionRows, error: permissionError } = await supabaseClient
    .from("role_permissions")
    .select("permissions(permission_code, permission_name)")
    .in("role_id", roleIds);

  if (permissionError) {
    console.error(permissionError);
    return;
  }

  currentPermissions = (permissionRows || [])
    .map((row) => row.permissions)
    .filter(Boolean);
}

function renderProfile() {
  const roleNames = currentRoles.map((r) => r.role_name).join("، ") || "لا يوجد دور";
  const permissionNames = currentPermissions.map((p) => p.permission_name).join("، ") || "لا توجد صلاحيات";
  const departmentName = currentProfile?.departments?.name_ar || "غير محددة";

  profileBox.innerHTML = `
    <div><strong>الاسم:</strong> ${currentProfile?.full_name || "-"}</div>
    <div><strong>البريد:</strong> ${currentProfile?.email || "-"}</div>
    <div><strong>الإدارة:</strong> ${departmentName}</div>
    <div><strong>الدور:</strong> ${roleNames}</div>
    <div><strong>الصلاحيات:</strong> ${permissionNames}</div>
  `;
}

function hasPermission(code) {
  return currentPermissions.some((p) => p.permission_code === code);
}

async function saveContent(event) {
  event.preventDefault();

  if (!hasPermission("create_content")) {
    formMessage.textContent = "لا تملك صلاحية إضافة محتوى.";
    return;
  }

  formMessage.textContent = "جاري حفظ المحتوى...";

  const keywordsValue = document.getElementById("keywords").value.trim();
  const keywords = keywordsValue
    ? keywordsValue.split(",").map((k) => k.trim()).filter(Boolean)
    : [];

  const item = {
    title: document.getElementById("title").value.trim(),
    content_type: document.getElementById("contentType").value,
    department_id: Number(document.getElementById("departmentId").value),
    summary: document.getElementById("summary").value.trim(),
    description: document.getElementById("description").value.trim(),
    keywords,
    status: document.getElementById("status").value,
    visibility: document.getElementById("visibility").value,
    created_by: currentUser.id
  };

  const { data, error } = await supabaseClient
    .from("content_items")
    .insert(item)
    .select()
    .single();

  if (error) {
    formMessage.textContent = "تعذر حفظ المحتوى: " + error.message;
    console.error(error);
    return;
  }

  await insertSpecializedRecord(data);
  formMessage.textContent = "تم حفظ المحتوى بنجاح.";
  contentForm.reset();
  await loadContent();
}

async function insertSpecializedRecord(contentItem) {
  const type = contentItem.content_type;

  const map = {
    course: { table: "courses", payload: { content_item_id: contentItem.id, course_name: contentItem.title } },
    training_bag: { table: "training_bags", payload: { content_item_id: contentItem.id, bag_name: contentItem.title } },
    library_item: { table: "library_items", payload: { content_item_id: contentItem.id, title: contentItem.title } },
    research_item: { table: "research_items", payload: { content_item_id: contentItem.id, title: contentItem.title } },
    journal_article: { table: "journal_articles", payload: { content_item_id: contentItem.id, article_title: contentItem.title } },
    announcement: { table: "announcements", payload: { content_item_id: contentItem.id, announcement_title: contentItem.title } }
  };

  if (!map[type]) return;

  const { error } = await supabaseClient
    .from(map[type].table)
    .insert(map[type].payload);

  if (error) {
    console.warn("تم حفظ content_items لكن تعذر حفظ الجدول التفصيلي:", error.message);
  }
}

async function loadContent() {
  const { data, error } = await supabaseClient
    .from("content_items")
    .select("*, departments(name_ar)")
    .order("created_at", { ascending: false });

  if (error) {
    contentTable.innerHTML = `<tr><td colspan="6">تعذر تحميل المحتوى: ${error.message}</td></tr>`;
    console.error(error);
    return;
  }

  allContent = data || [];
  renderContentTable();
}

function renderContentTable() {
  const search = searchInput.value.trim().toLowerCase();
  const type = filterType.value;

  let rows = allContent;

  if (type) {
    rows = rows.filter((item) => item.content_type === type);
  }

  if (search) {
    rows = rows.filter((item) => {
      const text = [
        item.title,
        item.summary,
        item.description,
        (item.keywords || []).join(" ")
      ].join(" ").toLowerCase();

      return text.includes(search);
    });
  }

  if (rows.length === 0) {
    contentTable.innerHTML = `<tr><td colspan="6">لا يوجد محتوى مضاف حتى الآن</td></tr>`;
    return;
  }

  contentTable.innerHTML = rows.map((item) => {
    const departmentName = item.departments?.name_ar || "-";
    return `
      <tr>
        <td>${escapeHtml(item.title)}</td>
        <td>${translateType(item.content_type)}</td>
        <td>${departmentName}</td>
        <td>${translateStatus(item.status)}</td>
        <td>${translateVisibility(item.visibility)}</td>
        <td>
          <div class="small-actions">
            <button class="small-btn" onclick="alertDetails(${item.id})">عرض</button>
            <button class="small-btn delete" onclick="deleteContent(${item.id})">حذف</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function alertDetails(id) {
  const item = allContent.find((x) => x.id === id);
  if (!item) return;

  alert(
    `العنوان: ${item.title}\n` +
    `النوع: ${translateType(item.content_type)}\n` +
    `الحالة: ${translateStatus(item.status)}\n` +
    `الملخص: ${item.summary || "-"}`
  );
}

async function deleteContent(id) {
  if (!hasPermission("delete_content")) {
    alert("لا تملك صلاحية حذف المحتوى.");
    return;
  }

  if (!confirm("هل تريد حذف هذا المحتوى؟")) return;

  const { error } = await supabaseClient
    .from("content_items")
    .delete()
    .eq("id", id);

  if (error) {
    alert("تعذر الحذف: " + error.message);
    return;
  }

  await loadContent();
}

async function logout() {
  await supabaseClient.auth.signOut();
  window.location.href = "login.html";
}

function translateType(type) {
  const map = {
    course: "دورة / برنامج",
    training_bag: "حقيبة تدريبية",
    library_item: "مصدر مكتبة",
    research_item: "بحث / دراسة",
    journal_article: "مقال مجلة",
    announcement: "إعلان / تعميم"
  };
  return map[type] || type;
}

function translateStatus(status) {
  const map = {
    draft: "مسودة",
    under_review: "قيد المراجعة",
    approved: "معتمد",
    published: "منشور",
    archived: "مؤرشف"
  };
  return map[status] || status;
}

function translateVisibility(value) {
  const map = {
    public: "عام",
    internal: "داخلي",
    restricted: "مقيد"
  };
  return map[value] || value;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
