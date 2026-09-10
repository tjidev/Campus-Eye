
alert("Welcome to CampusEye");
   function showDetails(role, email, password) {
        console.log("Role:", role);

        console.log("Email:", email);
        console.log("password:", password);



    }
    function greet(){
        console.log("hello karan!");
        console.log("welcome to campuseye!");
    }
let form = document.getElementById("loginForm");

form.addEventListener("submit", function (event) {
    event.preventDefault();
    console.log("button clicked");
    const role = document.getElementById("role").value;
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    if (email === "" || password === "") {
        console.log("please fill all fields");
        return;
    }
    if (role === "Student") {
        // window.location.href = "student_dashboard.html";
    } else {
        // window.location.href = "admin_dashboard.html";
    }
  
    greet();
    showDetails(role,email,password);
        
});

